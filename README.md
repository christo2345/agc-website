# AGC 2027 Website

American Graphic Contractors: The National Installation Partner.

Live: https://christo2345.github.io/agc-website/

`index.html` is the whole site (one self-contained file). The Wix page's HTML box loads it by address,
so every push to `main` updates the live site within about a minute. The version tag in the
bottom-left corner of the page shows which version is live.

## Partner Portal

The installers' portal lives in [`partner-portal/`](partner-portal/) and is live at
https://christo2345.github.io/agc-website/partner-portal/ (loaded by the Wix Vendor Portal page).

## Digital estimate (`/estimate/`)

`estimate/index.html` draws an AGC estimate from the data carried in its own link
(`/estimate/#d=<base64url JSON>`). Nothing about a client or a price is stored in this repo, and the part after `#`
is never sent to GitHub's servers. The Airtable agent "🧾 ESTIMATE BUILDER" writes the link into
AGC PROJECTS → 🧾 ESTIMATE LINK. The page prints on Letter (one page for a normal estimate) with
"Print / Save as PDF", and works on phones.
