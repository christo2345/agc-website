// ─────────────────────────────────────────────────────────────────────────
//  backend/mapKeys.js — the 🔑 MAP KEY on each AGC project (Nov 13 2026)
//
//  The Project Map (/project-map?id=…) and the Interactive Installer Map
//  (/interactive-installer-map?recordId=…) open from the PROJECT MAP and
//  FIND A PARTNER links in Airtable. Those links now carry the project's
//  random 🔑 MAP KEY (&k=…), and the backend only answers when the key is
//  right: a project's record ID alone no longer opens its map or saves zones.
//
//  fillMapKeys() gives every project that has no key a new random one. It runs
//  every hour (backend/jobs.config), so a new project's map links work within
//  the hour. Clearing a project's key gives it a new one (old links stop working).
// ─────────────────────────────────────────────────────────────────────────
import { getSecret } from 'wix-secrets-backend';
import { fetch } from 'wix-fetch';
import crypto from 'crypto';

const BASE = 'app7LeveIY3JoIqBp';
const PROJECTS = 'tblziZ2NmNH2m3HfJ';
export const MAP_KEY_FIELD = 'fldvlvop3czecccec';     // 🔑 MAP KEY
const AT = 'https://api.airtable.com/v0/';
const isRecId = (v) => /^rec[A-Za-z0-9]{14}$/.test(String(v || ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function airtable(path, opts = {}) {
  const key = await getSecret('AIRTABLE_TOKEN');
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(AT + path, {
      method: opts.method || 'GET',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    if (res.status === 429 && attempt < 3) { await sleep(1200 * (attempt + 1)); continue; }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error('Airtable ' + res.status); e.status = res.status; throw e; }
    return json;
  }
}

// Is this the right key for this project?
const cache = new Map();
export async function mapKeyOk(projectId, key) {
  const k = String(key || '');
  if (!isRecId(projectId) || k.length < 20 || k.length > 100) return false;
  let stored = '';
  const hit = cache.get(projectId);
  if (hit && Date.now() - hit.at < 60000) stored = hit.key;
  else {
    try {
      const rec = await airtable(`${BASE}/${PROJECTS}/${projectId}?returnFieldsByFieldId=true`);   // (a single-record read takes no fields[] filter)
      stored = String((rec.fields || {})[MAP_KEY_FIELD] || '').trim();
      cache.set(projectId, { key: stored, at: Date.now() });
    } catch (e) { return false; }
  }
  if (stored.length < 20) return false;
  const a = crypto.createHash('sha256').update(stored).digest(), b = crypto.createHash('sha256').update(k).digest();
  return crypto.timingSafeEqual(a, b);
}

const newKey = () => crypto.randomBytes(18).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// Give up to `max` projects without a key a new one. Returns counts only (never keys).
export async function fillMapKeys(max = 400) {
  const started = Date.now();
  let filled = 0;
  const formula = encodeURIComponent('LEN({' + MAP_KEY_FIELD + '}&"")=0');
  for (;;) {
    // Always the first page: every round fills what it reads, so the list shrinks.
    const page = await airtable(`${BASE}/${PROJECTS}?pageSize=100&returnFieldsByFieldId=true&fields%5B%5D=${MAP_KEY_FIELD}&filterByFormula=${formula}`);
    const ids = (page.records || []).map((r) => r.id);
    if (!ids.length) return { filled, more: false };
    for (let i = 0; i < ids.length; i += 10) {
      if (filled >= max || Date.now() - started > 11000) return { filled, more: true };
      const batch = ids.slice(i, i + 10);
      await airtable(`${BASE}/${PROJECTS}`, { method: 'PATCH', body: { records: batch.map((id) => ({ id, fields: { [MAP_KEY_FIELD]: newKey() } })) } });
      filled += batch.length;
      await sleep(220);
    }
  }
}

// Hourly job (backend/jobs.config). Keeps going in short rounds for up to ~4 minutes.
export async function fillMapKeysJob() {
  let total = 0;
  const until = Date.now() + 4 * 60 * 1000;
  for (;;) {
    const r = await fillMapKeys(400);
    total += r.filled;
    if (!r.more || Date.now() > until) return { filled: total, more: r.more };
  }
}
