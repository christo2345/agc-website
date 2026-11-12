# AGC Partner Portal

The installers' portal (Home, My Projects and My Profile in one self-contained file).

Live: https://christo2345.github.io/agc-website/partner-portal/

- `index.html` is the whole portal. The HTML box on the Wix **Vendor Portal** page loads it by address,
  so every push to `main` updates the live portal within about a minute.
- `version.json` holds the build number (Version 6.45 = 6045). On load the portal asks for it and, if it
  names a newer build, loads the fresh copy once — only while the sign-in screen is up, never while
  someone is signed in and working.
- The version tag in the corner of the sign-in card shows which version is live.
- Opened on its own (outside the Wix page) the portal stays on the sign-in screen: the Wix page is what
  tells it which installer is signing in.
- No keys or tokens are in this file.
- The portal fits the browser window: the Wix page tells it the window's height, and Home shrinks to
  fit a short window.

## The Wix side

The **Vendor Portal** page holds one full-screen HTML box (`#html3`) that loads the address above, on
desktop and on mobile, and nothing else. Its page code is kept here for reference in
[`wix/vendor-portal.page.js`](wix/vendor-portal.page.js): it hands the portal the installer's record ID
from the link (`/vendor-portal?id=rec…`) and the browser window's height. Changing that file here does
not change Wix; paste it into the page's code panel in the Wix editor.
