// sheets_api.js - Worker-safe client (no key on the browser; Worker injects it)
(function () {
  if (!window.SHEETS_API_URL) {
    console.warn('SHEETS_API_URL missing. Set it in config.js to your Worker URL.');
  }

  function handle(resp) {
    if (!resp.ok) throw new Error('Network error ' + resp.status);
    return resp.json();
  }

  // Build URL like: <WORKER_URL>?action=list[&from=YYYY-MM-DD][&to=YYYY-MM-DD]
  function buildListUrl(params = {}) {
    const url = new URL(window.SHEETS_API_URL);
    url.searchParams.set('action', 'list');
    if (params.from) url.searchParams.set('from', params.from);
    if (params.to)   url.searchParams.set('to', params.to);
    return url.toString();
  }

  // Body helper for POST form-encoded (no key included here; Worker adds it)
  function formBody(obj) {
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(obj)) {
      body.set(k, typeof v === 'string' ? v : JSON.stringify(v));
    }
    return body;
  }

  window.SheetsAPI = {
    // GET list (no key in query string)
    async listSchedules({ from = null, to = null } = {}) {
      const resp = await fetch(buildListUrl({ from, to }), { method: 'GET' });
      const json = await handle(resp);
      if (!json.ok) throw new Error(json.error || 'Unknown error');
      return json.rows || [];
    },

    // CREATE (form-encoded; action + record only)
    async createSchedule(rec) {
      const resp = await fetch(window.SHEETS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody({ action: 'create', record: rec }),
      });
      const json = await handle(resp);
      if (!json.ok) throw new Error(json.error || 'Create failed');
      return json.record;
    },

    // UPDATE
    async updateSchedule(rec) {
      const resp = await fetch(window.SHEETS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody({ action: 'update', record: rec }),
      });
      const json = await handle(resp);
      if (!json.ok) throw new Error(json.error || 'Update failed');
      return json.record;
    },

    // DELETE (soft-delete via ID)
    async deleteSchedule(id) {
      const resp = await fetch(window.SHEETS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody({ action: 'delete', id }),
      });
      const json = await handle(resp);
      if (!json.ok) throw new Error(json.error || 'Delete failed');
      return true;
    },
  };
})();
