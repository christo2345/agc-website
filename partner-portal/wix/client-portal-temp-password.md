# Client portal · temporary password · before / after

Same rule as the installer portal. Nothing is in Wix yet. The anchors were checked against the live editor code (each one found exactly once).
Airtable: new field **PORTAL TEMP PASSWORD** on AGC CLIENTS (done).

## How a first visit works after this
1. The client opens their CLIENT PORTAL URL. The usual password screen shows, with: "First visit? Enter the temporary password AGC sent you as your password."
2. They type the code. If it's right: "Thank you. Now create your own password." The usual create screen follows (confirm email + new password).
3. The server checks the code again when the password is saved, then clears it.
4. Wrong code: "That temporary password isn't right. Check the email from AGC and try again." 8 wrong tries = 15 minute lock.
5. No code on file: "Your portal isn't ready yet. Ask your AGC project manager for your temporary password, or call 1 (877) 395-7435."

The client portal's own screens (the HTML inside Wix) do not change. Only the two files below.

## File 1: backend/clientPortal.web.js

| Where | Before | After |
|---|---|---|
| New helpers (above clientLookup) | none | `TEMP_FIELD = 'PORTAL TEMP PASSWORD'`, `tempOf`, `needsTemp` (no password yet), `tempOk` (not case sensitive, timing safe), the two messages |
| clientLookup | `hasPassword: !!pwOf(rec),` | `hasPassword: !!pwOf(rec), needsTemp: needsTemp(rec),` |
| clientLogin, link with no password yet | `return { needsSetup: true … }` | no code on file → NO_TEMP · right code → `{ tempOk: true }` · wrong code → counted as a failed try + BAD_TEMP |
| clientCreatePassword | link + ticked email was enough | also needs the right code (`opts.temp`), else NO_TEMP / BAD_TEMP |
| Saving the password | `{ [PASSWORD_FIELD]: password }` | `{ [PASSWORD_FIELD]: password, [TEMP_FIELD]: '' }` (code used up) |
| Forgotten password note to AGC | "Clear PASSWORD … they'll create a new one from their CLIENT PORTAL URL." | "Clear PASSWORD …, put a new PORTAL TEMP PASSWORD and send it to them with their CLIENT PORTAL URL; they enter it, then create a new password." |

## File 2: Client Portal page code (public/pages/c8mpt.js)

| Where | Before | After |
|---|---|---|
| askToSignIn | `needsSetup: who.hasPassword === false` | the create screen only once the code was accepted; until then the password screen with the "First visit?" line |
| Sign-in answer | `else if (r.needsSetup && LINK) await askToSignIn();` | first: `r.tempOk` → keeps the code for this page visit and shows the create screen |
| Create password | `confirmEmail: …` | `confirmEmail: …, temp: <the code they entered>` |

## Found while reading the live code (not changed yet, your call)
- **Client passwords are stored as readable text.** PASSWORD on AGC CLIENTS holds the real password (23 clients today, e.g. KUBIK, Astley Gilbert, ICON). Anyone with Airtable access can read them. The installer portal stores only a scrambled fingerprint (PBKDF2). Fix: same scrambling for clients; each client's current password is converted the next time they sign in, so nobody has to reset. Before doing it: does anything else read or email that PASSWORD column?
- **clientLookup sends the client's full email address** to anyone holding the link (the screen shows it for the "confirm email" tick). The installer portal shows a masked hint instead (ja••••@kubik.com).
