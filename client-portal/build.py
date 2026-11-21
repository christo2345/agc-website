#!/usr/bin/env python3
"""Client portal 0.15.0: the installer portal's sign-in, lifted into the client portal.

    python3 -I client-portal/build.py

Reads   client-portal/live-0.14.31.html   (the client portal as it was live on Nov 21 2026)
        partner-portal/index.html         (the installer portal: its sign-in screen, the menu bar,
                                            the sounds, the star sky and the flashlight field)
        client-portal/signin.client.js    (the installer portal's gate code, pointed at the client messages)
Writes  client-portal/index.html          (paste into the Wix HTML embed on /client-portal; the map
                                            key is put back in at that moment, it is never in the repo)

Everything visual comes out of partner-portal/index.html by its own markers, so running this again
after an installer portal change brings the same change to the client sign-in.
"""
import re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
CLIENT = ROOT / 'client-portal' / 'live-0.14.31.html'
VENDOR = ROOT / 'partner-portal' / 'index.html'
GATE = ROOT / 'client-portal' / 'signin.client.js'
OUT = ROOT / 'client-portal' / 'index.html'
VERSION = '0.15.0'

c = CLIENT.read_text(encoding='utf-8')
v = VENDOR.read_text(encoding='utf-8')
gate = GATE.read_text(encoding='utf-8')


def between(s, start, end, incl_end=True, frm=0):
    i = s.index(start, frm)
    j = s.index(end, i + len(start))
    return s[i:j + (len(end) if incl_end else 0)]


def once(s, old, new):
    n = s.count(old)
    assert n == 1, (n, old[:90])
    return s.replace(old, new)


# ── 1. Styles ──────────────────────────────────────────────────────────────
first_style = between(v, '<style>', '</style>')
signin_css = between(first_style, '/* ═══════════ SIGN-IN (the password pop-up', '/* ═══════════ TOP NAVIGATION BAR', incl_end=False)
nav_css = first_style[first_style.index('/* ═══════════ TOP NAVIGATION BAR'):first_style.rindex('</style>')]
tokens = between(v, '<style id="agc-look-tokens">', '</style>')
tokens = tokens[len('<style id="agc-look-tokens">'):-len('</style>')]
# the shared tokens are the installer portal's; here they are held on the sign-in screen only,
# so the client portal's own variables of the same names are untouched
tokens = tokens.replace(':root{', '.agc-lock,header.nav{', 1)
# the flashlight canvas has the same class as the client portal's own: told apart by a second class
signin_css = once(signin_css, '.qc-pixels{position:fixed;inset:0;width:100%;height:100%;z-index:1001;pointer-events:none}',
                  '.qc-pixels.agc-lock-px{position:fixed;inset:0;width:100%;height:100%;z-index:30001;pointer-events:none}')
signin_css = signin_css.replace('.agc-view{', '.agc-view-unused{')   # (rules for the installer portal's three views)
nav_css = nav_css.replace('.agc-view{', '.agc-view-unused{')
own_css = '''
  /* ═══════════ CLIENT PORTAL (0.15.0) ═══════════ */
  /* the height of the part of the portal on screen: the client portal's --screen-cap (from the Wix page) */
  :root{--agc-cap:var(--screen-cap,100vh)}
  /* over everything of the client portal (its pop-ups go to 20000), under the loading wheel */
  .agc-lock{z-index:30000}
  header.nav{z-index:30010!important}
  .menu-scrim{z-index:30009!important}
  /* the bar is part of the sign-in screen: once signed in it fades away with it */
  header.nav#agc-nav{transition:opacity .45s cubic-bezier(.16,1,.3,1)}
  html:not(.agc-locked) header.nav#agc-nav,html:not(.agc-locked) .menu-scrim{opacity:0!important;visibility:hidden!important;pointer-events:none!important;transition:opacity .45s cubic-bezier(.16,1,.3,1),visibility 0s linear .45s!important}
'''
css_block = ('\n<!-- ═══════════ SIGN-IN, MENU BAR AND SOUND: the installer portal\'s own (client-portal/build.py) ═══════════ -->\n'
             '<style id="agc-signin-css">\n' + tokens + '\n' + signin_css + '\n' + nav_css + own_css + '</style>\n')

# ── 2. Markup ──────────────────────────────────────────────────────────────
nav_line = between(v, '<header class="nav" id="agc-nav">', '\n', incl_end=False)
to_top = '<span class="to-top" aria-hidden="true"></span>'
assert v.count(to_top) >= 1
lock_html = between(v, '<div class="agc-lock" id="agc-lock"', '\n</div>\n')

# the menu: the client portal's tiles in the installer portal's design (three rows of three, then Call us / Email us)
grid_start = '<div class="ap-panel"><div class="ap-grid">'
grid_end = '</div></div><div class="ap-grid ap-more">'
old_grid = between(nav_line, grid_start, grid_end)
icon = lambda vb, body: '<span class="ap-ic"><svg viewBox="%s" fill="currentColor" aria-hidden="true">%s</svg></span>' % (vb, body)
vendor_icon = lambda nav: re.search(r'data-nav="%s"[^>]*>(<span class="ap-ic">.*?</svg></span>)' % nav, old_grid).group(1)
house = re.search(r'data-nav="site" data-to="">(<span class="ap-ic">.*?</svg></span>)', old_grid).group(1)
tile = lambda nav, ic, t: '<button type="button" class="ap" data-nav="%s">%s<span class="ap-t">%s</span></button>' % (nav, ic, t)
card_ic = icon('0 0 24 24', '<path fill-rule="evenodd" d="M4.5 4h15A2.5 2.5 0 0 1 22 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 17.5v-11A2.5 2.5 0 0 1 4.5 4zM2 8.4v2.8h20V8.4zM5.5 14.6v2h5v-2z"/>')
credit_ic = icon('0 0 24 24', '<path fill-rule="evenodd" d="M6 2h8.2l5.3 5.3V20a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V4a2 2 0 0 1 1.5-2zm4.6 15.4 6-6-1.8-1.8-4.2 4.2-2-2-1.8 1.8z"/>')
tasks_ic = icon('0 0 24 24', '<path fill-rule="evenodd" d="M12 2a6.5 6.5 0 0 0-6.5 6.5v4.2L3.6 16a1.2 1.2 0 0 0 1 1.8h14.8a1.2 1.2 0 0 0 1-1.8l-1.9-3.3V8.5A6.5 6.5 0 0 0 12 2zm-2.8 17.3a2.9 2.9 0 0 0 5.6 0z"/>')
signout = re.search(r'(<button type="button" class="ap agc-ap-out" data-nav="signout">.*?</button>)', old_grid).group(1)
new_grid = (grid_start
            + '<a class="ap" href="https://www.americangraphiccontractors.com/" data-nav="site" data-to="">' + house + '<span class="ap-t">Home</span></a>'
            + tile('home', vendor_icon('home'), 'My Portal')
            + tile('calendar', vendor_icon('calendar'), 'My Calendar')
            + tile('projects', vendor_icon('projects'), 'My Projects')
            + tile('account', vendor_icon('profile'), 'My Account')
            + tile('tasks', tasks_ic, 'My Tasks')
            + tile('payment', card_ic, 'Make Payment')
            + tile('credit', credit_ic, 'Apply Credit')
            + signout
            + grid_end)
nav_line = once(nav_line, old_grid, new_grid)
nav_line = nav_line.replace('<button type="button" data-pay hidden tabindex="-1" aria-hidden="true"></button>', '')

# the installer portal's wording on the card that is not its own screen's text
lock_html = once(lock_html, '>New partner? Set up your profile<', '><')

# ── 3. The website's scripts for the bar (menu, AGC mark, sound, volume, tiles, Call / Email) ──
def script(head):
    i = v.index('<script>/* ' + head)
    return v[i:v.index('</script>', i) + len('</script>')]

scripts = '\n'.join(script(h) for h in [
    'PORTAL · screen height, phone / tablet marks',
    'WEBSITE · the menu: open / close, the dark mask behind it, Escape',
    'WEBSITE · the AGC mark: spins, and turns to face you under the mouse',
    'WEBSITE · the menu shrinks its tiles until all of them fit the window',
    'WEBSITE · menu tiles that are buttons also close the menu',
    'WEBSITE · SOUND: ambient space music and interface sounds',
    'WEBSITE · the volume pill beside the sound button',
    'WEBSITE · menu tiles: one slow bounce, then the menu closes and the tile does its job',
    'WEBSITE · Call us / Email us: the number or address is revealed in the menu, with a copy button',
])
field = between(v, '<script type="text/plain" id="agc-look-field">', '</script>')
field = once(field, "cvs.className = 'qc-pixels';", "cvs.className = 'qc-pixels agc-lock-px';")
space = between(v, '<script type="text/plain" id="agc-look-space">', '</script>')

markup = ('\n<!-- ═══════════ SIGN-IN SCREEN AND MENU BAR: the installer portal\'s own (client-portal/build.py; the code is signin.client.js) ═══════════ -->\n'
          + nav_line + '\n' + to_top + '\n' + lock_html + '\n' + scripts + '\n' + field + '\n' + space + '\n')

# ── 4. Into the client portal ──────────────────────────────────────────────
out = c
out = once(out, '</head>\n<body>', css_block + '</head>\n<body>')
old_auth = between(out, '<div class="auth" id="auth" hidden role="dialog"', '\n</div>\n')
assert '<div class="auth-ver" id="auth-ver"></div>' in old_auth
out = once(out, old_auth, markup)

# the old sign-in code → the installer portal's gate code
s0 = out.index('const Auth = { mode: \'signin\'')
s1 = out.index('/* ═════════════════════════════════════════════════════════════════════════\n   PIXEL FIELD', s0)
old_code = out[s0:s1]
assert 'function authForgotSent' in old_code and 'function signOut' in old_code
out = out[:s0] + gate + '\n' + out[s1:]
out = out.replace(' SIGN-IN — the portal\'s own login screen (see #auth).', ' SIGN-IN — the portal\'s own login screen (see #agc-lock; 0.15.0: the installer portal\'s).', 1)

bind_old = between(out, 'function bindAuth(){', '\n}\n')
out = once(out, bind_old, 'function bindAuth(){\n  startPixelField();\n  gateStart();\n}\n')

# messages from the page code
out = once(out, "const justSignedIn = Auth.open && $('auth-btn') && $('auth-btn').disabled;",
                "const justSignedIn = Auth.open && gel('go') && gel('go').disabled;")
out = once(out, "else if (m.type === 'agc_client_login_failed') { setAuthBusy(false); clearTimeout(Auth.t); $('auth-err').textContent = m.error || 'Sign-in failed. Please try again.'; }",
                "else if (m.type === 'agc_client_login_failed') authFailed(m.error || '');\n"
                "    else if (m.type === 'agc_client_temp_ok') { Auth.temp = Auth.tempTry || ''; gateShow('create'); }\n"
                "    else if (m.type === 'agc_client_temp_sent') authTempSent(m);")
# the preview outside Wix: ?temp=1 shows the first-visit screen
out = once(out, "needsSetup: /[?&]setup=1\\b/.test(location.search), email: 'jordan@northwind.example' });",
                "needsSetup: /[?&](setup|temp)=1\\b/.test(location.search), needsTemp: /[?&]temp=1\\b/.test(location.search), emailHint: 'jo••••@northwind.example' });")
# the client portal's own flashlight stays off on the sign-in screen (the sign-in screen has the installer portal's)
out = once(out, "if (b.classList.contains('auth-open')) return 'login';", "if (b.classList.contains('auth-open')) return '';")

# version
old_pill = re.search(r'<span class="ver-pill" id="portal-version" title="Client portal version 0\.14\.31 · updated [0-9-]+">v0\.14\.31</span>', out).group(0)
out = once(out, old_pill, '<span class="ver-pill" id="portal-version" title="Client portal version %s · updated 2026-11-21">v%s</span>' % (VERSION, VERSION))

assert 'id="auth"' not in out and "$('auth-" not in out, 'old sign-in left behind'
OUT.write_text(out, encoding='utf-8')
print('wrote', OUT.relative_to(ROOT), len(out.encode('utf-8')), 'bytes;', len(c.encode('utf-8')), 'before')
