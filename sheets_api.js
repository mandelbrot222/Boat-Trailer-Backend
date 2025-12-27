// sheets_api.js - minimal client for Apps Script backend
(async function(){
  if (!window.SHEETS_API_URL) {
    console.warn('SHEETS_API_URL missing. Set window.SHEETS_API_URL in config.js');
  }
  if (!window.SHEETS_API_KEY) {
    console.warn('SHEETS_API_KEY missing. Set window.SHEETS_API_KEY in config.js');
  }

  const headers = () => ({
    'Content-Type': 'application/json',
    'X-API-Key': window.SHEETS_API_KEY || ''
  });

  function handle(resp) {
    if (!resp.ok) throw new Error('Network error ' + resp.status);
    return resp.json();
  }

  window.SheetsAPI = {
    async listSchedules({from=null, to=null}={}) {
      const url = new URL(window.SHEETS_API_URL);
      url.searchParams.set('action','list');
      if (from) url.searchParams.set('from', from);
      if (to) url.searchParams.set('to', to);
      const resp = await fetch(url.toString(), { method: 'GET', headers: headers() });
      const json = await handle(resp);
      if (!json.ok) throw new Error(json.error || 'Unknown error');
      return json.rows || [];
    },
    async createSchedule(rec) {
      const resp = await fetch(window.SHEETS_API_URL, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ action: 'create', record: rec })
      });
      const json = await handle(resp);
      if (!json.ok) throw new Error(json.error || 'Create failed');
      return json.record;
    },
    async updateSchedule(rec) {
      const resp = await fetch(window.SHEETS_API_URL, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ action: 'update', record: rec })
      });
      const json = await handle(resp);
      if (!json.ok) throw new Error(json.error || 'Update failed');
      return json.record;
    },
    async deleteSchedule(id) {
      const resp = await fetch(window.SHEETS_API_URL, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ action: 'delete', id })
      });
      const json = await handle(resp);
      if (!json.ok) throw new Error(json.error || 'Delete failed');
      return true;
    }
  };
})();