# AGC Partner Portal

The installers' portal (Home, My Projects and My Profile in one self-contained file).

Live: https://christo2345.github.io/agc-website/partner-portal/

- `index.html` is the whole portal. The HTML box on the Wix **Vendor Portal** page loads it by address,
  so every push to `main` updates the live portal within about a minute.
- `version.json` holds the build number (Version 6.46 = 6046). On load the portal asks for it and, if it
  names a newer build, loads the fresh copy once — only while the sign-in screen is up, never while
  someone is signed in and working.
- The version tag in the corner of the sign-in card shows which version is live.
- Opened on its own (outside the Wix page) the portal stays on the sign-in screen: the Wix page is what
  signs the installer in.
- No secret keys or tokens are in this file. The only key is the public Mapbox browser key (`pk.…`).
- Sign-in is checked on the server (since 6.46). The portal never sees a password hash: it passes what
  the installer types to the Wix page, the Wix backend checks it and answers with a session token.
- Home, My Projects and My Profile never call Airtable or ImgBB themselves. The **secure bridge**
  (`#agc-bridge-src`, copied into each page) sends those calls to AGC's Wix backend (`/_functions`)
  with the session token, and the backend answers only with that installer's own record, projects,
  closeouts and uploads. No prices, profit, client details, internal notes or password hash ever come
  back; banking numbers come back masked (`••••1234`) and a masked value is never saved over the real one.
- Testing an unpublished backend: open the portal with `?agcdev=1` and it talks to `/_functions-dev`.
- The portal fits the browser window: the Wix page tells it the window's height, and Home shrinks to
  fit a short window.

## The Wix side

The **Vendor Portal** page holds one full-screen HTML box (`#html3`) that loads the address above, on
desktop and on mobile, and nothing else. Its page code is kept here for reference in
[`wix/vendor-portal.page.js`](wix/vendor-portal.page.js): it signs the installer in (the personal link
`/vendor-portal?id=rec…` names them; without it, email + password) and passes the window's height.

The backend files are in [`wix/`](wix/) too, for reference:
- `partnerPortal.web.js`: sign-in, create password, forgotten password (password checked on the server,
  stored as a salted PBKDF2 hash in PORTAL PASSWORD (ENCRYPTED); clearing that cell resets it).
- `partnerSession.js`: the session token shared by sign-in and the data endpoints (1 day; ends when the
  password is cleared or changed).
- `http-functions.js`: the portal's data endpoints. Every one needs the session, takes the installer
  from it, and checks the project / closeout belongs to them. In Wix the virtual office endpoints
  (LiveKit token, office page) follow at the end of the same file, unchanged.

- `mapKeys.js` + `jobs.config`: the 🔑 MAP KEY on each AGC project. The PROJECT MAP and FIND A PARTNER
  links carry it (`&k=…`), and the map pages (/project-map, /interactive-installer-map) only load or save
  with the right key. The Airtable automation "🔑 MAP KEY · new project → key right away" gives a new
  project its key the moment it is created; the hourly job is a backstop.
- `http-functions.atlas-part.js` + `atlas-bridge.js`: ATLAS AI (/atlas-ai and its copy). The 4 HTML
  embeds hold no Airtable token; the bridge script at the top of each one sends their calls to
  `atlasProject` (read one project, allowed fields only), `atlasCreate` (new project) and `atlasUpload`
  (files onto a project created in the last 3 hours, 8 MB cap). The token lives in Wix Secrets Manager.

Changing these files here does not change Wix; paste them into the Wix editor, Save, then Publish.
