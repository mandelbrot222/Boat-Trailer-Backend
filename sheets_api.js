// sheets_api.js - revised to avoid CORS preflight with Apps Script
(async function () {
  if (!window.SHEETS_API_URL) console.warn('SHEETS_API_URL missing.');
  if (!window.SHEETS_API_KEY) console.warn('SHEETS_API_KEY missing.');

  function handle(resp) {
    if (!resp.ok) throw new Error('Network error ' + resp.status);
    return resp.json();
  }

  window.SheetsAPI = {
    // GET list (key as query param; no custom headers)
    async listSchedules({ from = null, to = null } = {}) {
      const url = new URL(window.SHEETS_API_URL);
      url.searchParams.set('action', 'list');
      url.searchParams.set('key', window.SHEETS_API_KEY);
      if (from) url.searchParams.set('from', from);
      if (to) url.searchParams.set('to', to);

      const resp = await fetch(url.toString(), { method: 'GET' });
      const json = await handle(resp);
      if (!json.ok) throw new Error(json.error || 'Unknown error');
      return json.rows || [];
    },

    // CREATE (form-encoded body; key included)
    async createSchedule(rec) {
      const body = new URLSearchParams({
        action: 'create',
        key: window.SHEETS_API_KEY,
        record: JSON.stringify(rec),
      });
      const resp = await fetch(window.SHEETS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      const json = await handle(resp);
      if (!json.ok) throw new Error(json.error || 'Create failed');
      return json.record;
    },

    // UPDATE
    async updateSchedule(rec) {
      const body = new URLSearchParams({
        action: 'update',
        key: window.SHEETS_API_KEY,
        record: JSON.stringify(rec),
      });
      const resp = await fetch(window.SHEETS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      const json = await handle(resp);
      if (!json.ok) throw new Error(json.error || 'Update failed');
      return json.record;
    },

    // DELETE (soft-delete via ID)
    async deleteSchedule(id) {
      const body = new URLSearchParams({
        action: 'delete',
        key: window.SHEETS_API_KEY,
        id,
      });
      const resp = await fetch(window.SHEETS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      const json = await handle(resp);
      if (!json.ok) throw new Error(json.error || 'Delete failed');
      return true;
    },
  };
})();