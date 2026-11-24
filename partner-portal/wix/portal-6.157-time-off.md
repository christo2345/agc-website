# Portal 6.157: time off (backend part)

**Status: NOT PUBLISHED in Wix. Waiting for Chris's yes.** The portal build 6.157 is live and keeps its Time off button
hidden until these endpoints answer.

## What it adds

Three endpoints in `backend/http-functions.js`, pasted after the `function aiProject(p) {...}` line. The code is in
[`portal-6.157-time-off.backend.js`](portal-6.157-time-off.backend.js). They use the helpers the file already has
(`signedIn`, `airtableGET`, `airtablePOST`, `fetchByIds`, `okJson` and so on). No new keys, no new tables, no new fields.

| Endpoint | What it does |
| --- | --- |
| `GET timeOff` | The signed-in installer's rows from AGC Holiday Calendar (through their `AGC Holiday Calendar 2` link), plus the "AGC CLOSED" days. Rows AGC made come back as dates only, no notes. |
| `POST timeOffAdd` | Creates one row: Name `<First Last> (<Company>) - ON HOLIDAY` or `- NOT AVAILABLE`, Start Date, End Date, Status `SOON` (holiday) or `IN PROGRESS` (not available), INSTALLER = the signed-in installer, NOTES starting with "Added by the partner in the AGC Partner Portal". |
| `POST timeOffDelete` | Deletes one row, only when it is linked to the signed-in installer AND carries that NOTES marker. |

## Guard rails

- The installer always comes from the sign-in session, never from the request.
- Add: real dates only, not in the past, at most 2 years ahead, at most 92 days per entry, no duplicate range, at most
  40 rows per installer. The note is cut to 200 characters on one line.
- Delete: a row AGC made, another installer's row, or an "AGC CLOSED" row answers 403.
- Tested against a stand-in for Airtable (`node`, 16 cases) before any of it touched Wix.

## To apply

Same steps as 6.156: open the Wix editor, paste the block after the `aiProject` line, Save, reload and check, Publish
once, confirm in Site History that nothing else rode along, check the three endpoints answer 401 without a sign-in,
then copy the block into `http-functions.js` in this folder and mark this file PUBLISHED.
