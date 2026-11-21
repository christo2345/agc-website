// ═══════════════════════════════════════════════════════════════════════════
//  Page code for the Client Portal page (Wix Velo)
//  Portal version 0.15.0 (matches the number beside BETA in the HTML)
//  0.15.0 (Nov 21 2026): the sign-in screen is the installer portal's (temporary password,
//  then create your own; "Email me my temporary password"), same messages as the Vendor Portal page.
//  Paste into the page that holds the HTML component, then set HTML_ID to
//  that component's ID (Properties panel → ID).
//
//  No Wix login: the portal has its own sign-in screen (like the Mimuro
//  ambassador portal). Clients open their personal link from Airtable
//  (AGC CLIENTS → CLIENT PORTAL URL):
//     /client-portal?client=recXXXXXXXXXXXXXX
//  which greets them by name and asks for their password. The signed-in
//  session lasts only while the page is open: refreshing the page or
//  opening the link again asks for the password again.
// ═══════════════════════════════════════════════════════════════════════════
import { clientLookup, clientLogin, clientCreatePassword, clientForgotPassword, clientSendTemp,
         clientInit, clientRequest } from 'backend/clientPortal.web';
import wixLocation from 'wix-location-frontend';
import wixWindowFrontend from 'wix-window-frontend';
import { local } from 'wix-storage-frontend';

const HTML_ID = '#clientPortal';   // ← your HTML component's ID
const TOKEN_KEY = 'agcClientPortalSession';

// The contact from the personal link, if any.
// Only the record ID is kept, so a link with extra text after it still works.
const LINK = ((String((wixLocation.query && wixLocation.query.client) || '')).match(/rec[A-Za-z0-9]{14}/) || [''])[0];

// Fallback pages for the My Account tiles. The HTML sends its own url for
// each tile (CONFIG.accountSteps); these are used only if that's blank.
const ACCOUNT_PAGES = {
  account: '/account-info',
  payment: '/make-a-payment',
  credit:  '/apply-for-credit'
};

// ── session token (this browser only) ──
// The sign-in is kept in memory only, never saved in the browser, so a
// refresh or a new visit signs the client out and asks for the password.
let sessionToken = '';
function getToken()   { return sessionToken; }
function setToken(t)  { sessionToken = t || ''; }
function clearToken() { sessionToken = ''; }
// Remove sessions saved by versions before 0.10.0 (they lasted 30 days).
try { local.removeItem(TOKEN_KEY); } catch (e) { /* storage unavailable */ }

// Errors Wix raises before the backend runs (backend file missing or failing
// to load) arrive as a generic message; say what to check.
function friendly(e) {
  const msg = String((e && e.message) || e || '');
  if (/unable to handle the request/i.test(msg)) return 'The portal backend failed to start. Check Site Monitoring logs for backend/clientPortal.web.js.';
  return msg || 'Something went wrong. Please try again.';
}

// Finds the HTML embed even if its ID isn't exactly HTML_ID (Wix names new
// embeds #html1, #html2…). Only an HTML embed has onMessage.
function findPortal() {
  const ids = [HTML_ID, '#clientPortal', '#html1', '#html2', '#html3', '#html4', '#html5', '#htmlComponent1'];
  for (const id of ids) {
    try { const el = $w(id); if (el && typeof el.onMessage === 'function') return el; } catch (e) { /* not on this page */ }
  }
  return null;
}

$w.onReady(() => {
  const html = findPortal();
  if (!html) {
    console.error('AGC Client Portal: no HTML embed found. Click the HTML element in the Editor → Properties & Events → ID, and set it to "clientPortal".');
    return;
  }
  const send = (msg) => html.postMessage(msg);
  let starting = false;

  // Show the sign-in screen (greets the contact when they came from their link).
  let pendingTemp = '';   // the temporary password they just entered (first visit, Nov 21 2026)
  async function askToSignIn(message, setupReady) {
    let who = {};
    if (LINK) { try { who = await clientLookup({ client: LINK }); } catch (e) { who = {}; } }
    const found = !!(LINK && who.firstName !== undefined);
    send({ type: 'agc_client_login_required', linked: found,
           firstName: who.firstName || '', company: who.company || '', email: who.email || '', emailHint: who.emailHint || '',
           needsSetup: found && who.hasPassword === false, needsTemp: found && who.hasPassword === false && who.needsTemp === true && !setupReady,
           message: (LINK && !found) ? (who.error || "We couldn't find your portal link. Use the latest link from AGC, or sign in with your email.")
                                     : (message || who.error || '') });
  }
  // Signed in → hand the portal its client.
  function signedIn(r) {
    if (r.token) setToken(r.token);
    const { token, ...me } = r;
    send({ type: 'agc_client_init', ...me });
  }

  html.onMessage(async (event) => {
    const m = event.data || {};
    switch (m.type) {

      // The portal pings until it hears back.
      case 'agc_client_ready': {
        if (starting) return;
        starting = true;
        try {
          const token = getToken();
          if (!token) { await askToSignIn(); return; }
          const me = await clientInit({ token });
          // A personal link for a different contact → sign in as that contact.
          if (me.error || (LINK && me.clientId && me.clientId !== LINK)) {
            if (me.auth || !me.error) { clearToken(); await askToSignIn(me.auth ? me.error : ''); }
            else send({ type: 'agc_client_error', error: me.error });
            return;
          }
          send({ type: 'agc_client_init', ...me });
        } catch (e) {
          send({ type: 'agc_client_error', error: friendly(e) });
        } finally {
          setTimeout(() => { starting = false; }, 1500);
        }
        break;
      }

      // Sign-in screen → password (and email when there's no link).
      case 'agc_client_login': {
        try {
          const r = await clientLogin({ client: LINK, email: m.email || '', password: m.password || '' });
          if (r.token) signedIn(r);
          else if (r.tempOk && LINK) { pendingTemp = m.password || ''; await askToSignIn('Thank you. Now create your own password.', true); }
          else if (r.needsSetup && LINK) await askToSignIn();   // first visit: create a password
          else send({ type: 'agc_client_login_failed', error: r.error || 'Sign-in failed. Please try again.' });
        } catch (e) { send({ type: 'agc_client_login_failed', error: friendly(e) }); }
        break;
      }

      // First visit, step 1: the temporary password AGC emailed (0.15.0, as the installer portal).
      case 'agc_client_check_temp': {
        try {
          if (!LINK) { send({ type: 'agc_client_login_failed', error: 'Open the personal portal link AGC sent you.' }); break; }
          const r = await clientLogin({ client: LINK, email: '', password: m.temp || '' });
          if (r.tempOk) { pendingTemp = m.temp || ''; send({ type: 'agc_client_temp_ok' }); }
          else if (r.token) signedIn(r);
          else send({ type: 'agc_client_login_failed', error: r.error || "That temporary password isn't right. Check the email from AGC and try again." });
        } catch (e) { send({ type: 'agc_client_login_failed', error: friendly(e) }); }
        break;
      }

      // First visit: "Email me my temporary password" (only this link's own record; the address is masked).
      case 'agc_client_send_temp': {
        try {
          const r = LINK ? await clientSendTemp({ client: LINK }) : { error: 'Open the personal portal link AGC sent you.' };
          if (r.notTemp) send({ type: 'agc_client_temp_sent', error: 'A password is already set for this account. Sign in instead, or use "Forgotten your password?".' });
          else send({ type: 'agc_client_temp_sent', message: r.message || '', error: r.error || '' });
        } catch (e) { send({ type: 'agc_client_temp_sent', error: friendly(e) }); }
        break;
      }

      // First visit, step 2: create a password (with the temporary password just accepted).
      case 'agc_client_create_password': {
        try {
          const r = await clientCreatePassword({ client: LINK, password: m.password || '', confirmEmail: m.confirmEmail === true, temp: pendingTemp });
          if (r.token) signedIn(r);
          else send({ type: 'agc_client_login_failed', error: r.error || 'Could not save your password. Please try again.' });
        } catch (e) { send({ type: 'agc_client_login_failed', error: friendly(e) }); }
        break;
      }

      // "Forgotten your password?"
      case 'agc_client_forgot_password': {
        try {
          const t = LINK ? await clientSendTemp({ client: LINK }) : { notTemp: true };   // first visit: email the temporary password
          if (!t.notTemp) { send({ type: 'agc_client_forgot_sent', error: t.message || t.error || 'Please try again.' }); break; }
          const r = await clientForgotPassword({ client: LINK, email: m.email || '' });
          send({ type: 'agc_client_forgot_sent', error: r.error || '' });
        } catch (e) { send({ type: 'agc_client_forgot_sent', error: friendly(e) }); }
        break;
      }

      // Sign out (button in the portal).
      case 'agc_client_logout':
        clearToken();
        await askToSignIn();
        break;

      // Every data request from the dashboard and the projects viewer.
      case 'agc_client_request': {
        try {
          const data = await clientRequest(m.action, m.payload || {}, { token: getToken() });
          if (data && data.__error) {
            send({ type: 'agc_client_response', requestId: m.requestId, ok: false, error: data.__error });
            if (data.__auth) { clearToken(); await askToSignIn(data.__error); }
          } else {
            send({ type: 'agc_client_response', requestId: m.requestId, ok: true, data });
          }
        } catch (e) {
          send({ type: 'agc_client_response', requestId: m.requestId, ok: false, error: friendly(e) });
        }
        break;
      }

      // Full-screen viewer opened: bring the portal into view and tell it how
      // tall the browser window is, so its Close / Download bar stays on screen.
      case 'agc_client_lightbox': {
        try { await html.scrollTo(); } catch (e) { /* not available in the Editor preview */ }
        try {
          const r = await wixWindowFrontend.getBoundingRect();
          send({ type: 'agc_client_viewport', height: r && r.window ? r.window.height : 0 });
        } catch (e) { /* the viewer still opens */ }
        break;
      }

      // The portal asks how tall the browser window is (it changes when the
      // page is zoomed in or out) so it can fill it exactly.
      case 'agc_client_viewport_request': {
        try {
          const r = await wixWindowFrontend.getBoundingRect();
          send({ type: 'agc_client_viewport', layout: true, height: r && r.window ? r.window.height : 0 });
        } catch (e) { /* the portal keeps its current height */ }
        break;
      }

      // My Account tiles: Account Info / Make a Payment / Apply for Credit.
      case 'agc_client_go_to_account':
        wixLocation.to(m.url || ACCOUNT_PAGES[m.section] || ACCOUNT_PAGES.account);
        break;

      // HTML_HEIGHT_UPDATE is also sent and can be ignored: the portal fills
      // the component and never scrolls, so make the component full screen
      // in the editor.
    }
  });
});