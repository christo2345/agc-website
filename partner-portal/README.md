# AGC Partner Portal

The installers' portal (Home, My Projects and My Profile in one self-contained file).

Live: https://christo2345.github.io/agc-website/partner-portal/

- `index.html` is the whole portal. The HTML box on the Wix **Vendor Portal** page loads it by address,
  so every push to `main` updates the live portal within about a minute.
- `version.json` holds the build number (Version 6.135 = 6135). On load the portal asks for it and, if it
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
- In the portal ALFRED answers only from the portal (since 6.119). He answers the installer's
  questions about their own projects (schedule, address, budget, scope, notes, PPE, shipping,
  contacts, files, invoice, close-out, their list, their next job, their total) and their own
  profile (steps done, rates, insurance, contract, banking with account numbers masked, tax forms,
  services, service area), and says where things are in the portal. He reads the data from the same
  backend, with the same sign-in session, as the three pages, so he sees only what they see. Every
  figure, date and name in an answer comes from a field; an empty field is reported as empty, and a
  question the portal's data does not answer gets "I can't find that in your portal" with Call and
  Email. None of the website's written answers (its knowledge base, jokes, welcome-back lines) are
  carried into the portal, and the live answer service is not called from it. He recognizes
  questions by their wording (a list of patterns in `look/alfred.portal.js`), not with an AI model.
  Since 6.121 that list also covers onboarding ("am I fully onboarded", "what's missing"), single
  facts from the installer's record (website, emails, company, country…), and a question he cannot
  place gets an overview of what is on file instead of a dead end.
- The project on screen comes first (since 6.122). While a project is open in My Projects, a question
  that names no project ("what's the address", "budget", "tell me about this job") is about that
  one, his welcome names it, and the first chips are about it. Naming another job by its AGC number
  or name always wins. My Projects tells the portal which project is open (`agc_project_title`
  now carries the record id as well as the name and budget).
- The same holds in every view (since 6.123). On My Profile he answers about the step that is open
  (Basic Info and its part, Contract, Banking, Insurance, US Tax Forms): whether the portal ticks it
  and what is on file for it. In a project, "what's on this page" is answered for the section that
  is showing (Files, Scope, Schedule, Map, Shipping, Closeout). On Home he describes what the cards
  show, or the tool that is open (My Calendar, Upload Invoice, Service Area). The portal reads what
  is on screen from its own pages (`AGC_ALFRED_ONSCREEN` in the router).
- He answers weather questions (since 6.124): the forecast for a job's address on its install day
  (and due date), or for "today", "tomorrow" or a weekday, and says when a day is inside the
  thresholds My Projects warns on (below 5°C, wet, windy). He gets it the way the project's Weather
  view does: that page's own geocoder, then Open-Meteo's 7-day forecast (Celsius, km/h, mm). With no
  job named or on screen he uses the next job. A job with no address has no forecast.
- With sound on he reads his replies aloud (since 6.120), which sends the reply text to the voice
  service, the same one the website uses.
- What he says is made easy to listen to (since 6.125, `forVoice`); the written reply does not change.
  A job is said by its number only ("AGC 19046", never its long name), and "this job" after the first
  mention when the reply is about one job. CAD / USD / MXN are said as Canadian dollars / US dollars /
  Mexican pesos, with ".00" dropped. No symbols are read out (emoji, the dots and bars between facts,
  slashes, hashes, stars, arrows, brackets); a link is "the link", an email "name at domain dot com".
  An AGC number is read one digit at a time ("AGC 1 9 0 4 6"). Abbreviations are said in full: months,
  weekdays, street types and NW / NE / SW / SE, provinces and states after a city, units (km/h, mm, °C,
  ft, sq ft, ", hrs), sizes (34" x 72" = 34 inches by 72 inches) and short forms (PO, COI, TBD, ETA,
  approx, e.g.). A dollar sign is said as dollars ($100 = 100 dollars).
  A store is said short (since 6.126): its chain and store number only ("SDM 2 2 1", "Walmart 3 1 4 8",
  "RBC 6 8 0 0"), without the mall, street or city after it; a store with no number is said by the part
  before its location ("Scotiabank").
  An address is said by its city only (since 6.127): "1079 Douglas St, Victoria, BC V8W 2C5" = "Victoria",
  and "is at" a city becomes "is in". It uses the installer's own store addresses; about 1 in 100 has no
  city that can be read from it and is still said in full.
  Money is said in words (since 6.128): "$170,144.20 CAD" = "one hundred and seventy thousand, one hundred and
  forty four Canadian dollars and twenty cents" (English; in French and Spanish the voice reads the figure).
  Since 6.129: a project's AGC number is said the first time it comes up, then "this project", in that
  reply and the next ones, until the talk turns to another project (its number once, then "this project"
  again). A list of several projects keeps the numbers. "#" is never said: a store or unit number after it
  is read digit by digit. "ft2" and the like are "square foot". Years are left out of dates. Phone numbers
  are read digit by digit in their groups. A tracking number is "number ending in" its last four digits.
- Maps, forecast and drive time (6.131 fix): AGC_BUILD in index.html must equal version.json. It had stayed
  at 6124, so from 6.125 on every new version reloaded the page once after the Wix page had already handed
  over the Mapbox key (it sends it only once): no maps, no forecast. Now the build number matches, and the
  public Mapbox key (pk.) is kept for the browser tab so a reload cannot lose it. ALFRED's forecast and drive
  time start My Projects out of sight when it has not been opened yet.
- ALFRED answers drive time with traffic (since 6.131): "how long is the drive", "traffic", "how far",
  from the installer's own address to the job (Mapbox driving-traffic vs usual), with a Directions button
  that opens Google Maps with live traffic, and the project map button.
- Since 6.132 the voice never says an AGC number: a reply about one project says "this project" (but "your next job
  is ..." names it by its short store name), a reply naming several says each by its short store name ("Winners 2 1 6 0",
  "Lindt Halifax"). The budget answer is one line: the amount and how it is paid. Reopening the chat says
  "Hey <name>, have any questions about this project?" like the first welcome. The address answer starts
  "The address for your project in Calgary is listed below." (the voice says only that line).
  The chat's forecast uses the forecast the job's Weather view already has when that job is open in My Projects;
  otherwise the map's address lookup, or the job's city (Open-Meteo place search, no key) if that fails. The Weather
  view uses that city lookup too before falling back to the browser's location. The words of the question's topic
  (traffic, weather, budget...) no longer pick a job by its name ("traffic bad?" had picked "Install Traffic Signs").
  The scope answer is the scope (and brief) only: no Products / Size / Service type line.
  Dry humour (6.132): the welcome adds one dry line at random; "tell me a joke" (or the A joke chip) gets one of 12
  installer-shop jokes at random, no repeat until all are told; a question he cannot place gets a dry opener.
- Step 1 leak fix (Wix backend published Nov 20 2026, with 6.132): the backend no longer sends PROJECT STATUS / STATUS,
  the other installers (names, phones, ids), VENDOR INVOICES, INSTALLER UPDATES, the partner STATUS or INSURANCE AGENT,
  nor the budget of a job shared by several installers. It sends AGC SHARED JOB and AGC DELAYED (yes / no) instead, and
  hides the hands-off projects 17329, 17334, 19043 and 19072 everywhere. Home's Total AGC Earnings (and ALFRED's answer)
  count only jobs budgeted for this installer alone and approved by the client.
- Since 6.133 ALFRED calls the installer Mr or Miss + first name ("Hey Mr Patrick"), from SALUTATION on AGC INSTALLERS
  (sent by the backend). Blank or CHECK: the first name alone.
- Contacts (since 6.134): "Onsite contact: Store manager." and "Your project manager is Randall Moffatt, (917) 410-0970."
  The phone is said once (the PM field already holds it), no dash, plus a Call your project manager button.
- Temporary password (6.135 + Wix, Nov 20 2026): a first visit asks for the one-time code in PORTAL TEMP PASSWORD
  (AGC INSTALLERS) before the installer can create a password, so the personal link alone is no longer enough.
  The code is not case sensitive and is cleared when they create their password. No code on file = "ask your AGC
  project manager". A profile made in the last 2 hours (brand-new partner signing up) skips it. To reset a
  password: clear PORTAL PASSWORD (ENCRYPTED), put a new PORTAL TEMP PASSWORD and send it with the link.
  Wix: backend/partnerSession.js (IF.tempPassword), backend/partnerPortal.web.js (partnerCheckTemp), Vendor
  Portal page code (agc_partner_check_temp). Go live: portal page first (it still works with the old Wix code).
- ALFRED's welcome (since 6.130) is one line: "Hey <first name>, have any questions about this project?" (the
  project open on screen; otherwise "your projects", or "your profile" while on My Profile).
- Chat answers (since 6.129):
  - Text in the chat, Scope and Important Installer Notes is shown clean: no stray markdown signs or escapes.
  - Dates in the chat have no year.
  - Shipping shows each tracking number with a button that opens that carrier's tracking page.
  - "Where is it?" answers with the address only, a Google Maps button per address, and "See it on the
    project map", which opens the project in My Projects on its Map tab.
  - "Any updates?" says plainly that job updates are not in the portal yet, where the job stands, and who
    the project manager is, with a button to call them. (It used to dump the whole job summary.)
- His total earnings (since 6.128) are exactly the Total AGC Earnings box on Home and its project count, nothing
  more (no breakdown). Before the box has painted he makes the same sum the box makes.
- My Projects shows more of the job (since 6.156, Chris Nov 24 2026):
  - A due date on the same day as the scheduled date is not shown (Schedule, calendar, ALFRED).
  - Scope: "Equipment to bring" (AGC's approved list for the job) takes the place of Reach and PPE Required; a job with
    no approved list still shows Reach and PPE. Crew size. The lift, when the job has one.
  - Schedule: a row of facts under the dates: store hours on the install day (click for the whole week), date status
    and note, why the job is delayed, revisit dates, AGC's office closed on the install day or within 45 days.
  - Shipping: shipping address, number of packages (the field name had never matched), tracking by store, manifest.
  - Closeout: a row with Photo requirements (pop-up: the link, a YouTube video plays in place), Invoicing requirements
    (the PDF in the file pop-up), the installer's own invoice and whether it is paid (no amounts).
  - Weather: AGC's install-day weather note above the forecast. Files: the site survey and linked data sheets.
  - Store hours, equipment, bill status and AGC's closed days come from the call that feeds Field Ops ALFRED
    (`alfredAiContext`, asked once and kept 10 minutes: `AGC_PORTAL_EXTRAS` in the router). Date status and note, revisit
    dates, delay reason, lift, weather note, tracking by store, manifest, survey and data sheets need the backend change
    in [`wix/portal-6.156-fields.md`](wix/portal-6.156-fields.md): published in Wix on Nov 24 2026. The same change also sends the
    installer's onboarding status and what is missing, tax form, WCB, licences, height training and delivery instructions
    (no page shows those yet; Field Ops ALFRED receives them).
- Time off in My Calendar (since 6.157, Chris Nov 24 2026): an installer marks days as "On holiday" or "Not available".
  - Each range is one row in the AGC Holiday Calendar table in Airtable, linked to the installer, so the PMs see it where
    they already look. The portal lists the installer's rows, adds one, and removes only rows the installer added in the
    portal (rows AGC made for them show without a Remove button).
  - The calendar hatches those days in amber, rings a day in red when a job is already booked on it, and tags the days
    AGC's office is closed. A job's Schedule says "You marked this day off" when the install lands on one.
  - Needs three backend endpoints (`timeOff`, `timeOffAdd`, `timeOffDelete`), described in
    [`wix/portal-6.157-time-off.md`](wix/portal-6.157-time-off.md). Published in Wix on Nov 24 2026. The Time off button
    stays hidden whenever those endpoints do not answer.
- My Projects after Chris looked at Patrick's portal (since 6.158, Nov 24 2026):
  - Scope, right column (desktop): every block opens and closes on its title and the column never scrolls. What does not
    fit is closed from the bottom up; opening one closes others; a block too long on its own gets "See all" (pop-up).
    Order: Graphic Location, Qty installers, Equipment to bring (or Reach, PPE), Lift. Important Notes and Scope of Work
    fold on their titles too (a long Scope of Work still scrolls inside its own box).
  - Schedule: nothing sits above the calendar any more. Store hours, date status and note, delay reason and "you marked
    this day off" are one short line each inside the Scheduled box. AGC's closed days show on their own days of the month,
    red, like a holiday. Revisit dates are green dots labelled Trip 2, Trip 3 (the scheduled day is Trip 1), listed in the
    legend with their dates. The installer's time off is hatched amber. A Time off button opens the form in My Calendar.
  - Weather: a bar at the top says where the forecast is for ("Calgary, AB") and that it comes from Open-Meteo.
  - Closeout: asks the backend for this project's closeouts only (it asked for every project the installer has), and the
    store names show while that loads. The archived view's Google Drive link no longer keeps a stray ")".
  - Home: the Time off button in My Calendar is always shown; a failed load says why in the panel.
  - 6.161: Equipment to bring leaves out the rule "no equipment (charges and notes)" (it says there is nothing to bring).
  - 6.162: phone and tablet review. Measured on the live site: Wix shows the Vendor Portal page to every phone at 320 px wide (its mobile viewport) with the portal frame 320 x 760, and to tablets at 980 px or wider. So "phone" in this file means 320 px. My Projects and My Profile had no phone layout before this version.
    - My Projects on a phone (700 px and under): the list fills the screen; tapping a job opens it full screen with a "Projects" back button, the job's name, and the seven sections as a strip of buttons that scrolls sideways. Every section stacks in one column. Closeout shows the store list first, then one store at a time with a "Stores" back button.
    - My Projects on a tablet (701 to 1199 px): the list is a grid of cards; a job opens with the list hidden and a "Projects" button on top of the section buttons. From 1200 px up nothing changed.
    - My Profile on a phone: welcome and the five steps on one screen; a step opens full screen with a "Steps" back button; every form is one column with 16 px inputs.
    - Home on a phone: the Time off button no longer sits under the close button, the time off form is one column, menu labels wrap.
    - A phone turned sideways gets a line saying to turn it upright (Wix keeps the page 320 px wide and magnifies it, so nothing fits). Fixing that for real needs a change on the Wix page, not in this file.
    Which rules a job gets is decided in Airtable by the automation "🧰 SUGGESTED EQUIPMENT ON NEW JOBS", not in the portal.
  - 6.160: trip numbers go by date. The scheduled date and every revisit date are sorted, oldest first, and numbered from
    Trip 1, whichever Airtable field each was typed in. The same day twice counts once.
  - 6.159: Equipment to bring is one block per piece of equipment (title = the place or kind, body = what to bring) under a
    plain heading, not one block for the whole list. When they do not all fit open they all show as titles. The count is
    black on solid amber, and the open/close arrows are 20 px.
  - A layout image that will not load becomes a file tile (its old inline handler had a quoting slip).
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
