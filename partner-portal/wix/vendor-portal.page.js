// ─────────────────────────────────────────────────────────────────────────
//  Page code for the Vendor Portal page (Wix Velo) — same sign-in as the
//  Client Portal page.
//
//  The whole Partner Portal (Home, My Projects, My Profile) is one page,
//  loaded by address into a single HTML component:
//      https://christo2345.github.io/agc-website/partner-portal/
//  HTML_ID is that component's ID (Properties panel → ID).
//
//  No Wix login: the portal has its own sign-in screen. Installers open
//  their personal link from Airtable (AGC INSTALLERS → VENDOR PORTAL URL):
//      /vendor-portal?id=recXXXXXXXXXXXXXX
//  which greets them by name and asks for their password. The signed-in
//  session lasts only while the page is open: refreshing the page or
//  opening the link again asks for the password again.
//
//  The work is done by backend/partnerPortal.web.js. The portal learns
//  which installer it is showing only after the password has been checked.
// ─────────────────────────────────────────────────────────────────────────
import { partnerLookup, partnerLogin, partnerCreatePassword, partnerForgotPassword,
         partnerInit } from 'backend/partnerPortal.web';
import wixLocation from 'wix-location-frontend';
import wixWindowFrontend from 'wix-window-frontend';

const HTML_ID = '#html3';   // ← your HTML component's ID

// The installer from the personal link, if any.
// Only the record ID is kept, so a link with extra text after it still works.
const linkId = () => {
  try {
    const q = wixLocation.query || {};
    return (String(q.id || q.recordId || q.rec || '').match(/rec[A-Za-z0-9]{14}/) || [''])[0];
  } catch (e) { return ''; }
};
let LINK = linkId();

// ── session token (this browser only) ──
// The sign-in is kept in memory only, never saved in the browser, so a
// refresh or a new visit signs the installer out and asks for the password.
let sessionToken = '';
function getToken()   { return sessionToken; }
function setToken(t)  { sessionToken = t || ''; }
function clearToken() { sessionToken = ''; }

// Errors Wix raises before the backend runs (backend file missing or failing
// to load) arrive as a generic message; say what to check.
function friendly(e) {
  const msg = String((e && e.message) || e || '');
  if (/unable to handle the request/i.test(msg)) return 'The portal backend failed to start. Check Site Monitoring logs for backend/partnerPortal.web.js.';
  return msg || 'Something went wrong. Please try again.';
}

// Finds the HTML embed even if its ID isn't exactly HTML_ID (Wix names new
// embeds #html1, #html2…). Only an HTML embed has onMessage.
function findPortal() {
  const ids = [HTML_ID, '#partnerPortal', '#html3', '#html1', '#html2', '#html4', '#html5', '#htmlComponent1'];
  for (const id of ids) {
    try { const el = $w(id); if (el && typeof el.onMessage === 'function') return el; } catch (e) { /* not on this page */ }
  }
  return null;
}

$w.onReady(() => {
  const html = findPortal();
  if (!html) {
    console.error('AGC Partner Portal: no HTML embed found. Click the HTML element in the Editor → Properties & Events → ID, and set it to "html3".');
    return;
  }
  const send = (msg) => html.postMessage(msg);
  let starting = false;

  // Show the sign-in screen (greets the installer when they came from their link).
  async function askToSignIn(message) {
    let who = {};
    if (LINK) { try { who = await partnerLookup({ partner: LINK }); } catch (e) { who = {}; } }
    const found = !!(LINK && who.firstName !== undefined);
    send({ type: 'agc_partner_login_required', linked: found,
           firstName: who.firstName || '', email: who.email || '', emailHint: who.emailHint || '',
           needsSetup: who.hasPassword === false,
           message: (LINK && !found) ? (who.error || "We couldn't find your portal link. Use the latest link from AGC, or sign in with your email.")
                                     : (message || who.error || '') });
  }
  // Signed in → hand the portal its installer.
  function signedIn(r) {
    if (r.token) setToken(r.token);
    const { token, ...me } = r;
    send({ type: 'agc_partner_init', ...me });
  }

  html.onMessage(async (event) => {
    const m = event.data || {};
    switch (m.type) {

      // The portal pings until it hears back.
      case 'agc_partner_ready': {
        if (starting) return;
        starting = true;
        try {
          const token = getToken();
          if (!token) { await askToSignIn(); return; }
          const me = await partnerInit({ token });
          // A personal link for a different installer → sign in as that installer.
          if (me.error || (LINK && me.recordId && me.recordId !== LINK)) {
            if (me.auth || !me.error) { clearToken(); await askToSignIn(me.auth ? me.error : ''); }
            else send({ type: 'agc_partner_error', error: me.error });
            return;
          }
          send({ type: 'agc_partner_init', ...me });
        } catch (e) {
          send({ type: 'agc_partner_error', error: friendly(e) });
        } finally {
          setTimeout(() => { starting = false; }, 1500);
        }
        break;
      }

      // Sign-in screen → password (and email when there's no link).
      case 'agc_partner_login': {
        try {
          const r = await partnerLogin({ partner: LINK, email: m.email || '', password: m.password || '' });
          if (r.token) signedIn(r);
          else if (r.needsSetup && LINK) await askToSignIn();   // first visit: create a password
          else send({ type: 'agc_partner_login_failed', error: r.error || 'Sign-in failed. Please try again.' });
        } catch (e) { send({ type: 'agc_partner_login_failed', error: friendly(e) }); }
        break;
      }

      // First visit: create a password.
      case 'agc_partner_create_password': {
        try {
          const r = await partnerCreatePassword({ partner: LINK, password: m.password || '' });
          if (r.token) signedIn(r);
          else send({ type: 'agc_partner_login_failed', error: r.error || 'Could not save your password. Please try again.' });
        } catch (e) { send({ type: 'agc_partner_login_failed', error: friendly(e) }); }
        break;
      }

      // "Forgotten your password?"
      case 'agc_partner_forgot_password': {
        try {
          const r = await partnerForgotPassword({ partner: LINK, email: m.email || '' });
          send({ type: 'agc_partner_forgot_sent', error: r.error || '' });
        } catch (e) { send({ type: 'agc_partner_forgot_sent', error: friendly(e) }); }
        break;
      }

      // Sign out (menu in the portal, or five minutes without activity).
      case 'agc_partner_logout':
        clearToken();
        await askToSignIn(m.message || '');
        break;

      // My Profile created the installer's record: keep it on the address.
      case 'agc_recordId':
        if (m.recordId && /^rec[A-Za-z0-9]{14}$/.test(m.recordId) && m.recordId !== LINK) {
          LINK = m.recordId;
          try { wixLocation.queryParams.add({ id: m.recordId }); } catch (e) { /* the address stays as it is */ }
        }
        break;

      // The portal asks how tall the browser window is (it changes when the
      // window is resized or the page is zoomed) so it can fill it exactly.
      case 'agc_partner_viewport_request':
        try {
          const r = await wixWindowFrontend.getBoundingRect();
          send({ type: 'agc_partner_viewport', height: r && r.window ? r.window.height : 0 });
        } catch (e) { /* the portal keeps its current height */ }
        break;

      // HTML_HEIGHT_UPDATE is also sent and can be ignored: the portal fills
      // the component and scrolls inside itself, so keep the component full
      // screen in the editor.
    }
  });
});
