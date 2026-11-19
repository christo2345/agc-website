# AGC Partner Portal

The installers' portal (Home, My Projects and My Profile in one self-contained file).

Live: https://christo2345.github.io/agc-website/partner-portal/

- `index.html` is the whole portal. The HTML box on the Wix **Vendor Portal** page loads it by address,
  so every push to `main` updates the live portal within about a minute.
- `version.json` holds the build number (Version 6.118 = 6118). On load the portal asks for it and, if it
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
- The top bar is the AGC website's own header (since 6.109): the same markup, styles and scripts as
  `index.html` at the root of this repository, lifted out rule for rule, so the bar, the sound button
  with its volume pill and the menu panel look and behave the same in both places. The portal's bar
  carries the AGC mark, the job name and budget, the sound button and the menu button (no cart, no
  person button). Its menu is the portal's own list: Home (the website), My Portal, My Calendar,
  My Projects, My Profile, Upload Invoice, Service Area, Site Monkey and Sign out, then the website's
  own Call us / Email us row (since 6.118; the email is projects@).
- Home has two cards, My Projects and My Profile (since 6.117). My Toolbox is no longer a card: its
  tools (Upload Invoice, Service Area, Site Monkey) open from the menu. The old card is kept in the
  page, never shown, because the menu opens two of those pop-ups by pressing its buttons.
- ALFRED is in the portal (since 6.114), also the website's own: the bubble in the corner, his chat,
  the live 3D ALFRED whose head follows the pointer, his chimes and his voice when sound is on. He
  appears only once sign-in has succeeded. The 3D code is carried as inert text and only run the
  first time the chat is opened.
- Signed in, ALFRED is "unlocked" (since 6.115): he answers the installer's questions about their own
  projects (schedule, address, budget, scope, notes, PPE, shipping, contacts, files, invoice,
  close-out, their list, their next job, their total) and their own profile (steps done, rates,
  insurance, contract, banking with account numbers masked, tax forms, services, service area). He
  reads them from the same backend, with the same sign-in session, as the three pages, so he sees
  only what they see. Every figure, date and name in an answer comes from a field; an empty field is
  reported as empty. Those answers are worked out in the page: the question and the answer are not
  sent to the live answer service, and with sound on he says one fixed line rather than reading the
  data to the voice service. Anything that is not about the installer's own work or profile goes to
  the website's ALFRED exactly as before. His welcome says he is unlocked (since 6.116).
- When the website's header or ALFRED changes, the portal's copy is regenerated from the website file
  rather than edited by hand.

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
