
// ═══════════════════════════════════════════════════════════════════════════
// ATLAS AI (partner finder) — Nov 13 2026
// The two ATLAS AI pages used to call the ATLAS-AI Airtable base straight from
// the browser with an Airtable token written into the public page. Now their
// built-in bridge sends those calls here, and only these operations exist:
//   • read ONE ATLAS project by its record id (only the fields the page shows),
//   • create a project (name, scope, addresses),
//   • add files to a project created in the last 3 hours.
// The ATLAS base's other tables (prompts) and everything else are not reachable.
// ═══════════════════════════════════════════════════════════════════════════
const ATLAS_BASE = 'appkPDfgpoJ6PWEht';
const ATLAS_PROJECTS = 'tblQstliIYGTijfhK';
const ATLAS_READABLE = ['PROJECT NAME', 'PROJECT SCOPE', 'ADDRESS(ES)', 'ATTACHMENTS', 'JSON FILE', 'STATUS', 'URL', 'PDF FILE', 'PDF URL', 'PDF STATUS'];
const ATLAS_CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
const atlasJson = (status, body) => response({ status, headers: ATLAS_CORS, body });
async function atlasAirtable(path, opts) {
  const token = await getSecret('AIRTABLE_TOKEN');
  const res = await fetch(AIRTABLE_API + '/' + ATLAS_BASE + '/' + path, {
    method: (opts && opts.method) || 'GET',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: opts && opts.body ? JSON.stringify(opts.body) : undefined
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}
function atlasClean(rec) {
  const f = (rec && rec.fields) || {};
  const out = {};
  for (const k of ATLAS_READABLE) if (f[k] !== undefined) out[k] = f[k];
  return { id: rec.id, createdTime: rec.createdTime, fields: out };
}

export function options_atlasProject() { return response({ status: 204, headers: ATLAS_CORS }); }
export function options_atlasCreate() { return response({ status: 204, headers: ATLAS_CORS }); }
export function options_atlasUpload() { return response({ status: 204, headers: ATLAS_CORS }); }

// GET /_functions/atlasProject?id=recXXX
export async function get_atlasProject(request) {
  try {
    const id = request.query && request.query.id;
    if (!isRecordId(id)) return atlasJson(400, { error: 'invalid id' });
    const r = await atlasAirtable(ATLAS_PROJECTS + '/' + id);
    if (r.status === 404) return atlasJson(404, { error: { type: 'NOT_FOUND' } });
    if (!r.ok) return atlasJson(502, { error: 'read failed' });
    return atlasJson(200, atlasClean(r.body));
  } catch (e) { console.error('atlasProject', e); return atlasJson(500, { error: 'server error' }); }
}

// POST /_functions/atlasCreate   body: { fields: { 'PROJECT NAME', 'PROJECT SCOPE', 'ADDRESS(ES)' } }
export async function post_atlasCreate(request) {
  try {
    const b = await request.body.json().catch(() => ({}));
    const f = (b && b.fields) || {};
    const name = String(f['PROJECT NAME'] || '').trim();
    if (!name || name.length > 300) return atlasJson(400, { error: 'project name needed' });
    const fields = { 'PROJECT NAME': name, 'PROJECT SCOPE': String(f['PROJECT SCOPE'] || '').slice(0, 20000), 'ADDRESS(ES)': String(f['ADDRESS(ES)'] || '').slice(0, 20000) };
    const r = await atlasAirtable(ATLAS_PROJECTS, { method: 'POST', body: { fields } });
    if (!r.ok) return atlasJson(502, { error: 'create failed' });
    return atlasJson(200, atlasClean(r.body));
  } catch (e) { console.error('atlasCreate', e); return atlasJson(500, { error: 'server error' }); }
}

// POST /_functions/atlasUpload   body: { projectId, contentType, filename, file (base64) }
export async function post_atlasUpload(request) {
  try {
    const b = await request.body.json().catch(() => ({}));
    if (!b || !isRecordId(b.projectId)) return atlasJson(400, { error: 'invalid id' });
    if (!isStr(b.file, 16 * 1024 * 1024) || Math.floor(b.file.length * 0.75) > MAX_FILE_BYTES) return atlasJson(400, { error: 'file missing or too large' });
    const rec = await atlasAirtable(ATLAS_PROJECTS + '/' + b.projectId);
    if (!rec.ok) return atlasJson(404, { error: 'not found' });
    if (Date.now() - Date.parse(rec.body.createdTime || 0) > 3 * 3600 * 1000) return atlasJson(403, { error: 'files can only be added to a new project' });
    const token = await getSecret('AIRTABLE_TOKEN');
    const res = await fetch(AIRTABLE_CONTENT + '/' + ATLAS_BASE + '/' + b.projectId + '/ATTACHMENTS/uploadAttachment', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType: String(b.contentType || 'application/octet-stream').slice(0, 200), filename: String(b.filename || 'file').slice(0, 300), file: b.file })
    });
    if (!res.ok) return atlasJson(502, { error: 'upload failed' });
    return atlasJson(200, { ok: true });
  } catch (e) { console.error('atlasUpload', e); return atlasJson(500, { error: 'server error' }); }
}
