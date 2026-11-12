# AGC Partner Portal

The installers' portal (Home, My Projects and My Profile in one self-contained file).

Live: https://christo2345.github.io/agc-website/partner-portal/

- `index.html` is the whole portal. The HTML box on the Wix **Vendor Portal** page loads it by address,
  so every push to `main` updates the live portal within about a minute.
- `version.json` holds the build number (Version 6.44 = 6044). On load the portal asks for it and, if it
  names a newer build, loads the fresh copy once — only while the sign-in screen is up, never while
  someone is signed in and working.
- The version tag in the corner of the sign-in card shows which version is live.
- Opened on its own (outside the Wix page) the portal stays on the sign-in screen: the Wix page is what
  tells it which installer is signing in.
- No keys or tokens are in this file.
