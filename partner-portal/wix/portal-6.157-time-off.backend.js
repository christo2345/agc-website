
// ═══════════════════════════════════════════════════════════════════════════
// TIME OFF (portal 6.157 · Chris, Nov 24 2026: "yes")
// An installer marks the days they are on holiday or not available, from My Calendar in the portal. Each range is ONE row in
// AGC Holiday Calendar linked to the installer (INSTALLER), so the PMs and the hours-and-holiday check see it where they already
// look. The row is named like the ones AGC already makes: "First Last (Company) - ON HOLIDAY" / "- NOT AVAILABLE".
//   GET  /_functions/timeOff         { records: [{ id, from, to, kind, note, mine }], agcClosed: [{ name, from, to }] }
//                                    the installer's own rows that end today or later (AGC-made rows: dates only), and the days AGC is closed
//   POST /_functions/timeOffAdd      body { from, to, kind: 'holiday' | 'unavailable', note }   creates one row for the signed-in installer
//   POST /_functions/timeOffDelete   body { id }   only a row THIS PORTAL made for THIS installer (never a row AGC made)
// The installer always comes from the session. Nothing the browser sends can name another installer or another table.
// ═══════════════════════════════════════════════════════════════════════════
const TIMEOFF_MARK = 'Added by the partner in the AGC Partner Portal';
const TIMEOFF_LINK = 'AGC Holiday Calendar 2';   // on AGC INSTALLERS: the calendar rows linked to that installer
const TIMEOFF_MAX_DAYS = 92, TIMEOFF_MAX_ROWS = 40;
const isYmd = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T12:00:00Z'));
const ymdToday = () => new Date(Date.now() - 10 * 3600000).toISOString().slice(0, 10);   // still "today" late in the evening on the west coast
const ymdDays = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
async function timeOffRows(inst) {
  const r = await airtableGET('/' + BASE + '/' + INSTALLERS_TABLE + '/' + inst.id);
  if (!r.ok) return null;
  const ids = linkIds((r.body.fields || {})[TIMEOFF_LINK]);
  const recs = ids.length ? await fetchByIds(HOLIDAY_TABLE, ids) : [];
  return { installer: r.body.fields || {}, rows: recs.filter((x) => linkIds((x.fields || {})['INSTALLER']).indexOf(inst.id) >= 0) };   // second check on the row itself
}
function timeOffOut(x) {
  const f = x.fields || {}, notes = String(f['NOTES'] || ''), mine = notes.indexOf(TIMEOFF_MARK) >= 0;
  const from = String(f['Start Date'] || '').slice(0, 10), to = String(f['End Date'] || f['Start Date'] || '').slice(0, 10);
  const note = mine ? notes.split('\n').filter((l) => l.trim() && l.indexOf(TIMEOFF_MARK) < 0).join(' ').replace(/\s+/g, ' ').trim().slice(0, 200) : '';   // AGC's own notes are never sent
  return { id: x.id, from, to, kind: /NOT AVAILABLE/i.test(String(f['Name'] || '')) ? 'unavailable' : 'holiday', note, mine };
}
async function agcClosedDays() {
  try {
    const q = '?pageSize=50&filterByFormula=' + encodeURIComponent("AND(FIND('AGC CLOSED',UPPER({Name})),IS_AFTER(IF({End Date},{End Date},{Start Date}),DATEADD(TODAY(),-1,'days')))");
    const r = await airtableGET('/' + BASE + '/' + HOLIDAY_TABLE + q);
    if (!r.ok) return [];
    return ((r.body && r.body.records) || []).map((x) => ({ name: String((x.fields || {})['Name'] || '').trim(), from: String((x.fields || {})['Start Date'] || ''),
      to: String((x.fields || {})['End Date'] || (x.fields || {})['Start Date'] || '') })).filter((x) => x.from).sort((a, b) => a.from.localeCompare(b.from)).slice(0, 12);
  } catch (e) { console.warn('agcClosedDays', e && e.message); return []; }
}
export function options_timeOff(request) { return preflight(request); }
export function options_timeOffAdd(request) { return preflight(request); }
export function options_timeOffDelete(request) { return preflight(request); }
export async function get_timeOff(request) {
  try {
    const inst = await signedIn(request);
    if (!inst) return authJson(request);
    const t = await timeOffRows(inst);
    if (!t) return serverErrorJson('airtable read failed', request);
    const today = ymdToday();
    const records = t.rows.map(timeOffOut).filter((x) => isYmd(x.from) && isYmd(x.to) && x.to >= today).sort((a, b) => a.from.localeCompare(b.from)).slice(0, 60);
    return okJson({ records, agcClosed: await agcClosedDays() }, request);
  } catch (e) { console.error('timeOff', e); return serverErrorJson(null, request); }
}
export async function post_timeOffAdd(request) {
  try {
    const inst = await signedIn(request);
    if (!inst) return authJson(request);
    const body = await request.body.json();
    const from = body && String(body.from || ''), to = body && String(body.to || body.from || '');
    const kind = body && body.kind === 'unavailable' ? 'unavailable' : 'holiday';
    const today = ymdToday();
    if (!isYmd(from) || !isYmd(to)) return badRequestJson('Pick a first day and a last day.', request);
    if (to < from) return badRequestJson('The last day is before the first day.', request);
    if (to < today) return badRequestJson('Those days are already past.', request);
    if (ymdDays(today, from) > 730) return badRequestJson('That is more than two years away.', request);
    if (ymdDays(from, to) + 1 > TIMEOFF_MAX_DAYS) return badRequestJson('One entry can cover up to ' + TIMEOFF_MAX_DAYS + ' days. Add a second entry for the rest.', request);
    const t = await timeOffRows(inst);
    if (!t) return serverErrorJson('airtable read failed', request);
    const upcoming = t.rows.map(timeOffOut).filter((x) => isYmd(x.to) && x.to >= today);
    if (upcoming.some((x) => x.from === from && x.to === to)) return badRequestJson('Those days are already on your calendar.', request);
    if (upcoming.length >= TIMEOFF_MAX_ROWS) return badRequestJson('You have a lot of time off on file already. Remove an old entry first, or call AGC.', request);
    const f = t.installer, person = [f['FIRST NAME'], f['LAST NAME']].map((v) => String(v || '').trim()).filter(Boolean).join(' '), company = String(f['COMPANY'] || '').trim();
    const who = (person && company && person.toLowerCase() !== company.toLowerCase()) ? person + ' (' + company + ')' : (person || company || 'Installation partner');
    const note = String((body && body.note) || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
    const fields = { 'Name': (who + ' - ' + (kind === 'unavailable' ? 'NOT AVAILABLE' : 'ON HOLIDAY')).slice(0, 160), 'Start Date': from, 'End Date': to,
      'Status': from > today ? 'SOON' : 'IN PROGRESS', 'INSTALLER': [inst.id], 'NOTES': TIMEOFF_MARK + ' on ' + today + '.' + (note ? '\n' + note : '') };
    const r = await airtablePOST('/' + BASE + '/' + HOLIDAY_TABLE, fields);
    if (!r.ok) { console.warn('timeOffAdd airtable error', r.status); return serverErrorJson('could not save', request); }
    return createdJson({ ok: true, record: timeOffOut(r.body) }, request);
  } catch (e) { console.error('timeOffAdd', e); return serverErrorJson(null, request); }
}
export async function post_timeOffDelete(request) {
  try {
    const inst = await signedIn(request);
    if (!inst) return authJson(request);
    const body = await request.body.json();
    if (!body || !isRecordId(body.id)) return badRequestJson('invalid id', request);
    const t = await timeOffRows(inst);
    if (!t) return serverErrorJson('airtable read failed', request);
    const row = t.rows.find((x) => x.id === body.id);
    if (!row || String((row.fields || {})['NOTES'] || '').indexOf(TIMEOFF_MARK) < 0) return forbiddenJson(request);   // not theirs, or a row AGC made
    const headers = await airtableHeaders();
    const res = await fetch(AIRTABLE_API + '/' + BASE + '/' + HOLIDAY_TABLE + '/' + body.id, { method: 'DELETE', headers });
    if (!res.ok) { console.warn('timeOffDelete error', res.status); return serverErrorJson('airtable delete failed', request); }
    return okJson({ ok: true, id: body.id }, request);
  } catch (e) { console.error('timeOffDelete', e); return serverErrorJson(null, request); }
}
