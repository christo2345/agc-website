// ─────────────────────────────────────────────────────────────────────────
//  Page code for the Vendor Portal page (Wix Velo) — Partner Portal sign-in.
//
//  The whole Partner Portal (Home, My Projects, My Profile) is one HTML box
//  (#html3) that loads  https://christo2345.github.io/agc-website/partner-portal/
//  Installers open their personal link (AGC INSTALLERS → VENDOR PORTAL URL):
//      /vendor-portal?id=recXXXXXXXXXXXXXX
//  The portal shows its sign-in screen; the password is checked by
//  backend/partnerPortal.web.js on the server. After sign-in the portal gets
//  the installer's id and a session token, and sends the token with every
//  data call (backend/http-functions.js checks it). The session lives in this
//  page's memory only: a refresh or a new visit asks for the password again.
//  (Nov 13 2026, security rebuild.)
// ─────────────────────────────────────────────────────────────────────────
import { partnerLookup, partnerLogin, partnerCreatePassword, partnerForgotPassword, partnerInit } from 'backend/partnerPortal.web';
import wixLocation from 'wix-location-frontend';
import wixWindowFrontend from 'wix-window-frontend';

const HTML_ID = '#html3';
// The public Mapbox browser key (starts with pk.) for the project maps. Public by design, but it is set
// here in Wix only: GitHub's secret scanner blocks it in the repository copy of this file.
const MAPBOX_PUBLIC_KEY = '';

const linkId = () => {
  try {
    const q = wixLocation.query || {};
    return (String(q.id || q.recordId || q.rec || '').match(/rec[A-Za-z0-9]{14}/) || [''])[0];
  } catch (e) { return ''; }
};
let LINK = linkId();
let sessionToken = '';

function friendly(e) {
  const msg = String((e && e.message) || e || '');
  if (/unable to handle the request/i.test(msg)) return 'The portal backend failed to start. Please try again in a minute.';
  return msg || 'Something went wrong. Please try again.';
}
function findPortal() {
  const ids = [HTML_ID, '#partnerPortal', '#html1', '#html2', '#html4', '#html5', '#htmlComponent1'];
  for (const id of ids) {
    try { const el = $w(id); if (el && typeof el.onMessage === 'function') return el; } catch (e) { /* not on this page */ }
  }
  return null;
}

$w.onReady(() => {
  const html = findPortal();
  if (!html) { console.error('AGC Partner Portal: no HTML embed found (set the HTML box ID to "html3").'); return; }
  const send = (msg) => html.postMessage(msg);
  let starting = false, keysSent = false;

  async function askToSignIn(message) {
    let who = {};
    if (LINK) { try { who = await partnerLookup({ partner: LINK }); } catch (e) { who = {}; } }
    const found = !!(LINK && who.firstName !== undefined);
    send({ type: 'agc_partner_login_required', linked: found, firstName: who.firstName || '', emailHint: who.emailHint || '',
           needsSetup: found && who.hasPassword === false,
           message: (LINK && !found) ? (who.error || "We couldn't find your portal link. Use the latest link from AGC, or sign in with your email.") : (message || who.error || '') });
  }
  function signedIn(r) {
    if (r.token) sessionToken = r.token;
    send({ type: 'agc_partner_init', recordId: r.recordId, firstName: r.firstName || '', notice: r.notice || '', token: sessionToken });
  }

  html.onMessage(async (event) => {
    const m = event.data || {};
    switch (m.type) {
      case 'agc_partner_ready': {
        if (MAPBOX_PUBLIC_KEY && !keysSent) { keysSent = true; send({ type: 'agc_keys', keys: { mapbox: MAPBOX_PUBLIC_KEY } }); }
        if (starting) return;
        starting = true;
        try {
          if (!sessionToken) { await askToSignIn(); return; }
          const me = await partnerInit({ token: sessionToken });
          if (me.error || (LINK && me.recordId && me.recordId !== LINK)) {
            if (me.auth || !me.error) { sessionToken = ''; await askToSignIn(me.auth ? me.error : ''); }
            else send({ type: 'agc_partner_error', error: me.error });
            return;
          }
          signedIn(me);
        } catch (e) {
          send({ type: 'agc_partner_error', error: friendly(e) });
        } finally {
          setTimeout(() => { starting = false; }, 1500);
        }
        break;
      }
      case 'agc_partner_login': {
        try {
          const r = await partnerLogin({ partner: LINK, email: m.email || '', password: m.password || '' });
          if (r.token) signedIn(r);
          else if (r.needsSetup && LINK) await askToSignIn();
          else send({ type: 'agc_partner_login_failed', error: r.error || 'Sign-in failed. Please try again.' });
        } catch (e) { send({ type: 'agc_partner_login_failed', error: friendly(e) }); }
        break;
      }
      case 'agc_partner_create_password': {
        try {
          const r = await partnerCreatePassword({ partner: LINK, password: m.password || '' });
          if (r.token) signedIn(r);
          else send({ type: 'agc_partner_login_failed', error: r.error || 'Could not save your password. Please try again.' });
        } catch (e) { send({ type: 'agc_partner_login_failed', error: friendly(e) }); }
        break;
      }
      case 'agc_partner_forgot_password': {
        try {
          const r = await partnerForgotPassword({ partner: LINK, email: m.email || '' });
          send({ type: 'agc_partner_forgot_sent', error: r.error || '' });
        } catch (e) { send({ type: 'agc_partner_forgot_sent', error: friendly(e) }); }
        break;
      }
      case 'agc_partner_logout':
        sessionToken = '';
        break;
      // A brand-new partner's profile was just created: keep the id on the address and ask them to create a password.
      case 'agc_recordId':
        if (m.recordId && /^rec[A-Za-z0-9]{14}$/.test(m.recordId) && m.recordId !== LINK) {
          LINK = m.recordId;
          try { wixLocation.queryParams.add({ id: m.recordId }); } catch (e) { /* the address stays as it is */ }
          if (!sessionToken) await askToSignIn('Your profile is started. Create a password to protect it.');
        }
        break;
      case 'agc_partner_viewport_request':
        try {
          const r = await wixWindowFrontend.getBoundingRect();
          send({ type: 'agc_partner_viewport', height: r && r.window ? r.window.height : 0 });
        } catch (e) { /* the portal keeps its current height */ }
        break;
    }
  });
});
