// Machine-only endpoint for the scheduled background search job. Gated by
// the x-automation-key header matching the DASHBOARD_AUTOMATION_KEY
// environment variable -- a secret that only the scheduled job knows, never
// typed by a person and never sent from the dashboard's own browser code.
//
// Two actions, both POST with a JSON body:
//   { action: "status" }
//     -> { pending, lastRun, dueForMonth, month }
//        dueForMonth is true when no show report exists yet for the current
//        calendar month, so the scheduled job knows to run even if nobody
//        pressed "Run Fresh Search".
//   { action: "submitReport", shows: [...], triggeredBy, month? }
//     -> stores a new show report, updates show-search-last, and clears the
//        pending flag (if one was set).
const { checkAutomationKey, json, blobStore, newId, monthKey } = require('./dashboard-shared');

const STORE_NAME = 'business-dashboard';

async function getList(store, key) {
  const list = await store.get(key, { type: 'json' });
  return Array.isArray(list) ? list : [];
}

exports.handler = async (event) => {
  if (!checkAutomationKey(event)) {
    return json(401, { error: 'Not authorized' });
  }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Bad request' });
  }

  const store = blobStore(STORE_NAME);
  const action = body.action;
  const currentMonth = monthKey();

  if (action === 'status') {
    const [pending, lastRun, showReports] = await Promise.all([
      store.get('show-search-pending', { type: 'json' }),
      store.get('show-search-last', { type: 'json' }),
      getList(store, 'show-reports')
    ]);
    const dueForMonth = !showReports.some(r => r.month === currentMonth);
    return json(200, { pending: pending || null, lastRun: lastRun || null, dueForMonth, month: currentMonth });
  }

  if (action === 'submitReport') {
    const shows = Array.isArray(body.shows) ? body.shows : [];
    const triggeredBy = body.triggeredBy === 'manual' ? 'manual' : 'scheduled';
    const month = body.month || currentMonth;
    const now = new Date().toISOString();

    const report = {
      id: newId('report'),
      month,
      ranAt: now,
      triggeredBy,
      shows: shows.map(s => ({
        name: String(s.name || '').trim(),
        date: String(s.date || '').trim(),
        location: String(s.location || '').trim(),
        drivingTime: String(s.drivingTime || '').trim(),
        admission: String(s.admission || '').trim(),
        rating: Math.max(1, Math.min(5, Number(s.rating) || 3)),
        notes: String(s.notes || '').trim(),
        sourceUrl: String(s.sourceUrl || '').trim()
      }))
    };

    const list = await getList(store, 'show-reports');
    list.push(report);
    await store.setJSON('show-reports', list);

    const lastRun = { ranAt: now, triggeredBy, showCount: report.shows.length, month };
    await store.setJSON('show-search-last', lastRun);

    // Any successful run clears a pending manual request, whether this run
    // itself was the manual one or a monthly automatic run beat it to it.
    await store.setJSON('show-search-pending', null);

    return json(200, { report, lastRun });
  }

  return json(400, { error: 'Unknown action' });
};
