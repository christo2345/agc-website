/* ═════════════════════════════════════════════════════════════════════════
   SIGN-IN 0.15.0 (Chris, Nov 21 2026): the client portal signs in exactly like the installer portal.
   Same screen (#agc-lock: card, star sky, flashlight field), same menu bar on top (AGC mark, sound
   button, menu), same sounds, same steps and wording. The markup, styles and website scripts are
   lifted from partner-portal/index.html by client-portal/build.py; this is the installer portal's
   gate code (gateShow / gateArm / gateFit / gateSubmit ...) pointed at the client messages.
   The page code (public/pages/c8mpt.js) does the work with Velo:
     portal → Wix:  agc_client_ready, agc_client_login {password | email+password},
                    agc_client_check_temp {temp}, agc_client_send_temp, agc_client_create_password {password, temp},
                    agc_client_forgot_password {email}, agc_client_logout
     Wix → portal:  agc_client_login_required {linked, firstName, emailHint, needsSetup, needsTemp, message},
                    agc_client_temp_ok, agc_client_temp_sent {message, error}, agc_client_init,
                    agc_client_login_failed {error}, agc_client_forgot_sent {error}, agc_client_error {error}
   Signed in, the screen and the bar fade away and the portal is exactly as before (the sound goes quiet;
   the choice is kept, so the sound button pulses green next time as a reminder, as on the website).
   ═════════════════════════════════════════════════════════════════════════ */
const Auth = { mode: 'wait', linked: false, open: false, demo: false, onDemo: null, t: 0, hideT: 0,
               name: '', emailHint: '', temp: '', tempTry: '', armed: false, busy: false, create: false };
const PW_MIN = 8;
function gel(id){ return document.getElementById('agc-lock-' + id); }
function gateErr(t){ gel('msg').textContent = t || ''; }
function setAuthBusy(b){
  Auth.busy = b; const go = gel('go'); go.disabled = b; go.classList.toggle('busy', b); clearTimeout(Auth.t);
  if (b) Auth.t = setTimeout(() => { if (Auth.busy) { setAuthBusy(false); gateErr("The portal didn't answer. Please try again."); } }, 25000);
}
function gateSky(on){ try { if (window.__agcSpaceOn) window.__agcSpaceOn(on); } catch (e) {} }     /* the stars behind the pop-up */
function gateShow(mode, message){
  Auth.mode = mode;
  const form = (mode === 'create' || mode === 'enter' || mode === 'email' || mode === 'temp');
  const create = mode === 'create';
  const hi = Auth.name ? ', ' + Auth.name : '';
  let title = 'Welcome', sub = 'Checking your account…', go = 'Sign in';
  if (mode === 'offline') { title = "Can't reach the portal"; sub = message || "We couldn't check your account. Check your connection and try again."; go = 'Try again'; }
  else if (mode === 'nohost') { title = 'Open your AGC portal link'; sub = 'The Client Portal opens from the AGC website. Use the portal link AGC sent you.'; }
  else if (mode === 'temp') { title = 'Welcome' + hi; sub = 'Enter the temporary password AGC sent you. Next, you will create your own.'; go = 'Continue'; }
  else if (create) { title = 'Welcome' + hi; sub = "Create a password to protect your Client Portal. You'll enter it each time you sign in."; go = 'Create password'; }
  else if (mode === 'email') { title = 'Welcome back'; sub = 'Sign in with your email and Client Portal password.'; }
  else if (form) { title = 'Welcome back' + hi; sub = 'Enter your password to open your Client Portal.'; }
  gel('title').textContent = title; gel('sub').textContent = sub;
  gel('spin').hidden = mode !== 'wait';
  gel('body').hidden = (mode === 'wait' || mode === 'nohost');
  gel('new').hidden = true;
  gel('email-row').hidden = mode !== 'email';
  gel('pw-row').hidden = !form;
  gel('pw2-row').hidden = !create;
  gel('pw-label').textContent = create ? 'Create password (' + PW_MIN + '+ characters)' : (mode === 'temp' ? 'Temporary password' : 'Password');
  Auth.create = create; if (Auth.armed) gel('pw').setAttribute('autocomplete', create ? 'new-password' : 'current-password');
  gel('go').textContent = go;
  gel('go').hidden = !(form || mode === 'offline');
  gel('forgot').hidden = !form || create;
  gel('forgot').textContent = mode === 'temp' ? 'Email me my temporary password' : 'Forgotten your password?';
  gel('flip').hidden = true;
  gel('dev').hidden = true;
  gel('hint').textContent = (form && message) ? message
    : ((mode === 'enter' && Auth.emailHint) ? 'Signing in as ' + Auth.emailHint
    : (mode === 'temp' ? 'No temporary password? Press "Email me my temporary password" below, or call AGC at 1 (877) 395-7435.'
    : (Auth.demo && form ? 'Preview: any password works here.' : '')));
  gel('pw').value = ''; gel('pw2').value = '';
  gateErr(''); setAuthBusy(false);
  clearTimeout(Auth.hideT);
  try { closePanels(); closeCalendar(); closeAccountView(); } catch (e) {}
  document.body.classList.remove('view-projects');
  const box = document.getElementById('agc-lock');
  box.hidden = false; box.classList.remove('is-leaving'); gateSky(true);
  document.body.classList.add('auth-open'); Auth.open = true;
  document.documentElement.classList.add('agc-locked');                 /* the bar shows; its menu hides "Sign out" */
  gateFit(); setTimeout(gateFit, 250);
  if (form && Auth.armed) setTimeout(() => { try { (mode === 'email' ? gel('email') : gel('pw')).focus(); } catch (e) {} }, 80);
}
/* The installer portal's reason, which holds here too: Wix only opens its message channel once the
   embed has finished loading, and a password manager adding its own frame next to a password box
   while the page is loading can stop that. So the boxes are plain hidden inputs until loading is over. */
function gateArm(){
  if (Auth.armed) return;
  Auth.armed = true;
  const a = gel('pw'), b = gel('pw2'), m = gel('email');
  a.type = 'password'; a.name = 'password'; a.setAttribute('autocomplete', Auth.create ? 'new-password' : 'current-password');
  b.type = 'password'; b.name = 'confirm'; b.setAttribute('autocomplete', 'new-password');
  m.type = 'email'; m.name = 'email'; m.setAttribute('autocomplete', 'username');
  document.getElementById('agc-lock').classList.add('is-armed');
  if (Auth.open && !gel('pw-row').hidden && !gel('body').hidden) setTimeout(() => { try { (Auth.mode === 'email' ? m : a).focus(); } catch (e) {} }, 80);
}
/* In a short window the card is scaled down so all of it shows without scrolling. */
function gateFit(){
  try {
    const box = document.getElementById('agc-lock'), card = gel('form');
    if (!card || box.hidden) return;
    card.style.zoom = '';
    const cs = getComputedStyle(box), room = box.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom), need = card.offsetHeight;
    if (room > 120 && need > room + 1) card.style.zoom = Math.max(0.6, room / need).toFixed(3);
  } catch (e) {}
}
window.addEventListener('resize', () => setTimeout(gateFit, 60));
/* What the page code says on the way in: the screen for this person. */
function showAuth(o){
  o = o || {};
  Auth.linked = !!o.linked;
  Auth.name = String(o.firstName || '').trim().split(/\s+/)[0] || '';
  Auth.emailHint = String(o.emailHint || o.email || '');
  Auth.temp = ''; Auth.tempTry = '';
  gateShow(o.needsSetup ? (o.needsTemp ? 'temp' : 'create') : (o.linked ? 'enter' : 'email'), o.message || '');
}
/* Signed in: the screen and the bar fade away, the portal is as it always was. */
function hideAuth(){
  const box = document.getElementById('agc-lock');
  document.body.classList.remove('auth-open'); Auth.open = false; clearTimeout(Auth.t);
  document.documentElement.classList.remove('agc-locked');
  try { if (document.getElementById('links').classList.contains('open')) setMenu(false); } catch (e) {}
  /* the bar (and its sound button) goes, so the sound goes quiet; the choice is kept for next time */
  try { if (window.AGC_soundOn && AGC_soundOn()) { document.getElementById('sndBtn').click(); localStorage.setItem('agcSound', '1'); } } catch (e) {}
  box.classList.add('is-leaving');
  clearTimeout(Auth.hideT);
  Auth.hideT = setTimeout(() => { box.hidden = true; gateSky(false); }, 460);
}
function gateSubmit(ev){
  ev.preventDefault();
  if (Auth.busy) return;
  const mode = Auth.mode, pw = gel('pw').value, cf = gel('pw2').value, mail = (gel('email').value || '').trim();
  if (mode === 'offline') { location.reload(); return; }
  if (mode !== 'create' && mode !== 'enter' && mode !== 'email' && mode !== 'temp') return;
  if (mode === 'temp') {
    if (!pw.trim()) { gateErr('Please enter the temporary password from AGC.'); gel('pw').focus(); return; }
    gateErr(''); setAuthBusy(true); Auth.tempTry = pw.trim();
    if (Auth.demo) { setTimeout(() => { Auth.temp = Auth.tempTry; gateShow('create'); }, 350); return; }
    Bridge.post({ type: 'agc_client_check_temp', temp: Auth.tempTry }); return;
  }
  if (mode === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) { gateErr('Please enter your email address.'); gel('email').focus(); return; }
  if (!pw) { gateErr('Please enter your password.'); gel('pw').focus(); return; }
  if (mode === 'create' && pw.trim().length < PW_MIN) { gateErr('Please use at least ' + PW_MIN + ' characters.'); gel('pw').focus(); return; }
  if (mode === 'create' && pw !== cf) { gateErr('The two passwords do not match.'); gel('pw2').focus(); return; }
  gateErr(''); setAuthBusy(true);
  if (Auth.demo) { if (window.AGC_wheel) AGC_wheel(null, { label: 'Signing you in' }); setTimeout(() => { hideAuth(); const go = Auth.onDemo; Auth.onDemo = null; if (go) go(); }, 450); return; }
  if (mode === 'create') Bridge.post({ type: 'agc_client_create_password', password: pw, temp: Auth.temp || '', confirmEmail: true });
  else Bridge.post({ type: 'agc_client_login', password: pw, email: mode === 'email' ? mail : '' });
}
/* "Forgotten your password?" answered */
function authForgotSent(error){
  setAuthBusy(false);
  gel('hint').textContent = error ? error : 'AGC has been told. Once your password is reset, open the portal from your AGC link to create a new one.';
}
/* "Email me my temporary password" answered */
function authTempSent(m){
  setAuthBusy(false);
  if (m.error) { gel('hint').textContent = ''; gateErr(m.error); } else { gateErr(''); gel('hint').textContent = m.message || 'We emailed your temporary password. It can take a minute or two.'; }
  try { gel('pw').focus(); } catch (e) {}
}
function authFailed(error){
  setAuthBusy(false); gateErr(error || "That didn't work. Please try again.");
  try { gel('pw').select(); } catch (e) {}
}
function clearClientCaches(){
  [window.sessionStorage, window.localStorage].forEach(st => {
    try { Object.keys(st).forEach(k => { if (/^agc_client_projects/.test(k)) st.removeItem(k); }); } catch (e) {}
  });
}
function signOut(){
  clearClientCaches();
  if (Bridge.isDemo()) { Auth.demo = true; Auth.onDemo = null; showAuth({ linked: true, firstName: (State.user && State.user.firstName) || '' }); return; }
  Bridge.post({ type: 'agc_client_logout' });
}

/* ── THE MENU BAR (the AGC website's own bar, lifted with the sign-in screen) ──
   Signed out, as in the installer portal: "Home" leaves for the AGC website, the other tiles point at the
   sign-in box. Signed in the bar is not on screen; the tiles still know where they go. */
const AGC_SITE_HOME = 'https://www.americangraphiccontractors.com/';
function siteGo(to){
  const url = AGC_SITE_HOME + (to ? '#' + to : '');
  try { window.top.location.href = url; }
  catch (e) { try { window.open(url, '_blank', 'noopener'); } catch (e2) {} }
}
function navGo(act, to){
  try { if (document.getElementById('links').classList.contains('open')) setMenu(false); } catch (e) {}
  if (Auth.open) {
    if (act === 'site') siteGo(to || '');
    else { try { const boxes = document.querySelectorAll('#agc-lock-email-row:not([hidden]) input, #agc-lock-pw-row:not([hidden]) input'); if (boxes[0]) boxes[0].focus(); } catch (e) {} }
    return;
  }
  try {
    switch (act) {
      case 'site': siteGo(to || ''); break;
      case 'home': resetNav(); closePanels(); break;
      case 'projects': goToProjects(); break;
      case 'tasks': goToProjects(); openTasks(); break;
      case 'calendar': openCalendar(); break;
      case 'account': case 'payment': case 'credit': resetNav(); closePanels(); openAccountView(); break;
      case 'signout': signOut(); break;
    }
  } catch (e) {}
}
document.addEventListener('click', e => {
  const el = e.target && e.target.closest ? e.target : null;
  if (!el) return;
  const go = el.closest('[data-nav]');
  if (go) { e.preventDefault(); navGo(go.getAttribute('data-nav'), go.getAttribute('data-to')); }
});

function gateStart(){
  gel('form').addEventListener('submit', gateSubmit);
  gel('eye').addEventListener('click', function(){
    if (!Auth.armed) return;
    const show = gel('pw').type === 'password';
    gel('pw').type = gel('pw2').type = show ? 'text' : 'password';
    this.classList.toggle('on', show); this.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });
  gel('forgot').addEventListener('click', () => {
    gateErr('');
    if (Auth.mode === 'temp') {
      if (Auth.busy) return;
      gel('hint').textContent = 'Sending…'; setAuthBusy(true);
      if (Auth.demo) { setTimeout(() => authTempSent({ message: 'Preview: in the real portal the temporary password is emailed to the address AGC has on file.' }), 500); return; }
      Bridge.post({ type: 'agc_client_send_temp' }); return;
    }
    const mail = (gel('email').value || '').trim();
    if (Auth.mode === 'email' && !mail) { gateErr('Enter your email first, then press "Forgotten your password?" again.'); gel('email').focus(); return; }
    gel('hint').textContent = 'Sending…';
    if (Auth.demo) { setTimeout(() => authForgotSent(''), 400); return; }
    Bridge.post({ type: 'agc_client_forgot_password', email: Auth.mode === 'email' ? mail : '' });
  });
  const v = document.getElementById('portal-version');
  gel('ver').textContent = v ? 'Version ' + v.textContent.trim().replace(/^v/i, '') : '';
  /* the flashlight field on the card and the star sky: the installer portal's own code, run the same way */
  const unescapeBlock = s => s.replace(/<\\\/script/g, '<' + '/script').replace(/<\\!--/g, '<' + '!--');
  const text = id => { const el = document.getElementById(id); return el ? el.textContent : ''; };
  try {
    window.AGC_LOOK_FIELD = {
      accent: '#92C64B',
      specs: [
        { sel: '.agc-lock-card', caster: true, lift: 2.6, pad: 12, lit: 1.7 },
        { sel: '.agc-lock-go, .agc-lock-input input, .agc-lock:not(.is-armed) .agc-lock-input', caster: true, lift: 1.1, dark: 1.05, soft: 0.9, pad: 0, on: '.agc-lock-card' }
      ],
      off: function(){ const b = document.getElementById('agc-lock'); return !b || b.hidden || b.classList.contains('is-leaving'); }
    };
    (new Function(unescapeBlock(text('agc-look-field'))))();
  } catch (e) {}
  try {
    (new Function(unescapeBlock(text('agc-look-space'))))();
    const sky = document.querySelector('canvas.agc-space'), lockBox = document.getElementById('agc-lock');
    if (sky && lockBox) lockBox.insertBefore(sky, lockBox.firstChild);
  } catch (e) {}
  gateShow(Bridge.inWix ? 'wait' : 'nohost');
  /* the password boxes are switched on once this page has finished loading (see gateArm) */
  let armed = false; const arm = () => { if (!armed) { armed = true; gateArm(); } };
  if (document.readyState === 'complete') setTimeout(arm, 0); else window.addEventListener('load', () => setTimeout(arm, 0));
  setTimeout(arm, 5000);
}
