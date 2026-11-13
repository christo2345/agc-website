/* AGC ATLAS BRIDGE (Nov 13 2026). This page no longer holds an Airtable key. Its calls to the
   ATLAS-AI base go to AGC's Wix backend instead, which only allows: read one ATLAS project,
   create a project, add files to a new project. */
(function(){
  if (window.__agcAtlasBridge) return; window.__agcAtlasBridge = true;
  var FN = 'https://www.americangraphiccontractors.com/_functions';
  var BASE = 'appkPDfgpoJ6PWEht';
  var _fetch = window.fetch.bind(window);
  function jres(o, s){ return new Response(JSON.stringify(o), { status: s || 200, headers: { 'Content-Type': 'application/json' } }); }
  function bodyOf(init){ try { return init && typeof init.body === 'string' ? JSON.parse(init.body) : {}; } catch (e) { return {}; } }
  function post(name, body){ return _fetch(FN + '/' + name, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
  window.fetch = function(input, init){
    var url = typeof input === 'string' ? input : ((input && input.url) || '');
    var method = ((init && init.method) || 'GET').toUpperCase();
    try {
      if (url.indexOf('https://api.airtable.com/v0/' + BASE + '/') === 0) {
        var parts = new URL(url).pathname.split('/');   /* ['', 'v0', base, table, rec] */
        var rec = parts[4];
        if (method === 'GET' && rec) return _fetch(FN + '/atlasProject?id=' + encodeURIComponent(rec));
        if (method === 'POST' && !rec) return post('atlasCreate', { fields: (bodyOf(init).fields) || ((bodyOf(init).records || [])[0] || {}).fields || {} });
        if (method === 'PATCH' && rec) return Promise.resolve(jres({ id: rec, fields: {} }));     /* nothing on this page needs saving back */
        return Promise.resolve(jres({ error: { type: 'NOT_ALLOWED' } }, 403));
      }
      if (url.indexOf('https://content.airtable.com/v0/' + BASE + '/') === 0) {
        var p = new URL(url).pathname.split('/'), b = bodyOf(init);   /* ['', 'v0', base, rec, field, 'uploadAttachment'] */
        return post('atlasUpload', { projectId: p[3], contentType: b.contentType, filename: b.filename, file: b.file });
      }
    } catch (e) { return Promise.reject(e); }
    return _fetch(input, init);
  };
})();
