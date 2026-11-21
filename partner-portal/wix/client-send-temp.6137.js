// First visit: email me my temporary password (Chris, Nov 21 2026). Stamps TEMP PASSWORD REQUESTED on this link's own
// record; the Airtable automation "Email client their temp password" emails the code to the address on file only.
// Never shows the code or the full address. At most once every 2 minutes (was 10); pressing again inside the 2 minutes
// sends nothing and says so, with how long until they can ask again. { notTemp: true } = they have a password.
const TEMP_ASKED_FIELD = 'TEMP PASSWORD REQUESTED';
const SEND_GAP_MS = 2 * 60 * 1000;
function waitText(ms) {
  const s = Math.max(1, Math.ceil(ms / 1000)), m = Math.floor(s / 60), r = s % 60;
  const part = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  return m ? part(m, 'minute') + (r ? ' ' + part(r, 'second') : '') : part(r, 'second');
}
export const clientSendTemp = webMethod(Permissions.Anyone, async (opts = {}) => {
  try {
    const link = isRecId(opts.client) ? opts.client : '';
    if (!link) return { notTemp: true };
    const rec = await getClientRecord(link, true);
    if (!rec || pwOf(rec)) return { notTemp: true };
    const mail = String(rec.fields['EMAIL ADDRESS'] || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return { error: "We don't have an email address for you yet. Call AGC at 1 (877) 395-7435 and we'll set you up." };
    if (!tempOf(rec)) return { error: 'Your temporary password is being made. Try again in a minute.' };
    const sent = 'We emailed your temporary password to ' + maskEmail(mail) + '. It can take a minute or two, so check your junk folder too. Enter it above as your password.';
    const last = Date.parse(rec.fields[TEMP_ASKED_FIELD] || '');
    if (last && Date.now() - last < SEND_GAP_MS) {   // inside the limit: nothing is sent this time
      return { ok: true, already: true, message: 'We already emailed your temporary password to ' + maskEmail(mail) + '. Check your inbox and junk folder, then enter it above as your password. You can ask for another email in ' + waitText(SEND_GAP_MS - (Date.now() - last)) + '.' };
    }
    await airtable(`${BASE}/${CLIENTS}/${rec.id}`, { method: 'PATCH', body: { fields: { [TEMP_ASKED_FIELD]: new Date().toISOString() } } });
    clientById.delete(rec.id);
    return { ok: true, message: sent };
  } catch (e) { return { error: explain(e) }; }
});