// ─────────────────────────────────────────────────────────────────────────
//  Page code for the Vendor Portal page (Wix Velo) — one HTML box
//
//  The whole Partner Portal (Home, My Projects, My Profile) is one page,
//  loaded by address into a single HTML component:
//      https://christo2345.github.io/agc-website/partner-portal/
//  HTML_ID is that component's ID (Properties panel → ID).
//
//  Installers open their personal link:
//      /vendor-portal?id=recXXXXXXXXXXXXXX
//  This code does three small jobs:
//    1. tells the portal which installer the link is for (the record ID);
//    2. tells the portal how tall the browser window is, so it can fill
//       the window exactly (same idea as the Client Portal page);
//    3. keeps the record ID on the address when My Profile creates a new
//       installer record.
//  The portal has its own sign-in screen; everything else (moving between
//  Home, My Projects and My Profile, weather and delayed-project notices)
//  happens inside the portal itself.
// ─────────────────────────────────────────────────────────────────────────
import wixLocation from 'wix-location-frontend';
import wixWindowFrontend from 'wix-window-frontend';

const HTML_ID = '#html3';   // ← your HTML component's ID

// The installer from the personal link, if any. Only a real record ID is kept.
function linkId() {
  try {
    const q = wixLocation.query || {};
    const raw = String(q.id || q.recordId || q.rec || '');
    return (raw.match(/rec[A-Za-z0-9]{14}/) || [''])[0];
  } catch (e) {
    return '';
  }
}

// Finds the HTML embed even if its ID isn't exactly HTML_ID.
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
  let recordId = linkId();

  html.onMessage(async (event) => {
    const m = event.data || {};
    switch (m.type) {

      // The portal asks who this is, and keeps asking until it hears back.
      case 'agc_request_record_id':
      case 'agc_intro_ready':
      case 'agc_iframe_ready':
      case 'agc_projects_ready':
        if (recordId) send({ type: 'recordId', recordId });
        break;

      // My Profile created (or confirmed) the installer's record: keep it on the address.
      case 'agc_recordId':
        if (m.recordId && m.recordId !== recordId) {
          recordId = m.recordId;
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

      // HTML_HEIGHT_UPDATE and anything else can be ignored: the portal fills
      // the component and scrolls inside itself, so keep the component full
      // screen in the editor.
    }
  });
});
