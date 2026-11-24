# Portal 6.156: fields to add to the Wix backend (NOT published yet)

Chris, Nov 24 2026. The portal page (6.156) already shows these when the backend sends them. Until
`backend/http-functions.js` is changed in Wix and published, they simply stay empty in the portal.
Nothing here changes what the portal can write; these are read-only additions.

## 1. Projects: `PROJECT_READABLE`

Find:

```js
  'AGC PROJECT MANAGER', 'AGC PROJECT MANAGER:', 'PM Name', 'PM Direct'
  // STEP 1: PROJECT STATUS and STATUS
```

Replace with:

```js
  'AGC PROJECT MANAGER', 'AGC PROJECT MANAGER:', 'PM Name', 'PM Direct',
  // 6.156 (Chris, Nov 24 2026): how firm the date is, revisits, why it is delayed, the lift, AGC's install-day weather
  // note, per-store tracking, the manifest, the site survey and the linked data sheets. Never lift prices.
  '📅 DATE STATUS', '📅 DATE NOTE', 'REASON PROJECT IS DELAYED',
  'REVISIT DATE 1:', 'REVISIT DATE 2:', 'REVISIT DATE 3:', 'REVISIT DATE 4:', 'REVISIT DATE 5:',
  'REVISIT DATE 6:', 'REVISIT DATE 7:', 'REVISIT DATE 8:', 'REVISIT DATE 9:', 'REVISIT DATE 10:',
  'LIFT STATUS', 'Aerial Lift Type (from Aerial Lifts)', 'Supplier (from Aerial Lifts)', 'AERIAL LIFT DETAILS', 'TOTAL DAYS REQUIRED',
  '🌦️ WEATHER', '📦 TRACKING BY STORE', '📦 SHIPPING MANIFEST',
  'SURVEYS', 'Data Sheet (from Data Sheets)', 'Product Name (from Data Sheets)'
  // STEP 1: PROJECT STATUS and STATUS
```

## 2. Projects: `cleanProject`

These text fields are written for the office too, so the office-only lines are cut on the server
(they never reach the browser or Field Ops ALFRED), and a text that names the owner is not sent.

Find:

```js
  if (shared) for (const k of SHARED_JOB_HIDDEN) delete out[k];
```

Replace with:

```js
  if (shared) for (const k of SHARED_JOB_HIDDEN) delete out[k];
  // 6.156: 🌦️ WEATHER without its "🔔 card sent for" log line; 📦 TRACKING BY STORE without its "📄 PDF ... drafted to ..." lines.
  const keepLines = (v, drop) => String(v == null ? '' : v).split('\n').filter((l) => l.trim() && !drop.test(l)).join('\n').trim();
  if (out['🌦️ WEATHER'] != null) out['🌦️ WEATHER'] = keepLines(out['🌦️ WEATHER'], /^\s*🔔/);
  if (out['📦 TRACKING BY STORE'] != null) out['📦 TRACKING BY STORE'] = keepLines(out['📦 TRACKING BY STORE'], /^\s*📄|drafted to/i);
  for (const k of ['📅 DATE NOTE', 'REASON PROJECT IS DELAYED', '🌦️ WEATHER', '📦 TRACKING BY STORE', '📦 SHIPPING MANIFEST', 'AERIAL LIFT DETAILS'])
    if (out[k] != null && (!String(out[k]).trim() || OWNER_NAME.test(String(out[k])))) delete out[k];
```

(`OWNER_NAME` is declared just below `cleanProject` with `const`; it is only read when the function
runs, so the order is fine.)

## 3. Installers: `INSTALLER_READABLE` (portal views for these come in a later build)

Find:

```js
  'SALUTATION',   // Mr / Miss for ALFRED (Nov 20 2026)
```

Replace with:

```js
  'SALUTATION',   // Mr / Miss for ALFRED (Nov 20 2026)
  // 6.156 (Chris, Nov 24 2026): onboarding status and what is missing, the tax form on file, WCB, licences, height training, delivery instructions
  '🤝 ONBOARDING', '🤝 MISSING', '🤝 TAX FORM', '🤝 TAX FORM SIGNED', '🤝 TAX FORM VALID UNTIL',
  '🦺 WORKERS COMP / WCB VALID UNTIL', '🦺 WORKERS COMP / WCB FILES', 'Vendor has WCB',
  '🪪 LICENCES', '🪪 LICENCE FILES', '🦺 HEIGHT TRAINING', 'DELIVERY INSTRUCTIONS',
```

## 4. Installers: `cleanInstaller`

`🤝 MISSING` sometimes ends with "possible duplicate of <another partner>": that part names another
installer and is never sent.

Find:

```js
    out[k] = MASKED_INSTALLER_FIELDS.indexOf(k) >= 0 ? mask(fields[k]) : fields[k];
```

Replace with:

```js
    out[k] = MASKED_INSTALLER_FIELDS.indexOf(k) >= 0 ? mask(fields[k]) : fields[k];
    if (k === '🤝 MISSING') out[k] = String(fields[k] || '').split(' · ').filter((x) => x.trim() && !/duplicate/i.test(x)).join(' · ');   // 6.156
```

## What was checked in Airtable (Nov 24 2026)

- `📅 DATE STATUS`, `📅 DATE NOTE` and `📦 SHIPPING MANIFEST` are empty on every project today.
- `📦 TRACKING BY STORE` is filled on one project; its second line is an office log line.
- `LIFT STATUS` is "NOT ORDERED YET" on many jobs that have no lift: the portal shows the lift block
  only when a lift type, details or days are filled in, or the status is something else.
- `SURVEYS` holds the same file ("SITE-SURVEYS (1).pdf") on the 59 projects sampled.
- `⚠️ REPEAT RISKS` must never be added: it holds behaviour profiles of clients and of the installer.
