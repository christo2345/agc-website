# Client sign-in tests

`signin_flow.py` runs the built `client-portal/index.html` inside a mock Wix page that runs the real page code
(`wix/c8mpt.0150.js`, imports swapped for a fake backend), then walks a first visit: email me my temporary
password (twice: the second press says it was already sent), a wrong code, the right code, two passwords
that do not match, then a new password and the portal opening. Needs Playwright and Chrome.
The harness page is made by the snippet at the top of the session notes; rebuild it before running.
