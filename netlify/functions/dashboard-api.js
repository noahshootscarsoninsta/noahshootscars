// All private-dashboard data actions (customers, private shoots, show-search
// request + reports) go through this one function, gated by the
// x-dashboard-key header matching the DASHBOARD_ADMIN_KEY environment
// variable. Nothing here is reachable without that key, and the key is
// never committed to git or written into any frontend file.
const { checkAdminKey, json, blobStore, newId, monthKey } = require('./dashboard-shared');

const STORE_NAME = 'business-dashboard';

async function getList(store, key) {
  const list = await store.get(key, { type: 'json' });
  return Array.isArray(list) ? list : [];
}

exports.handler = async (event) => {
  if (!checkAdminKey(event)) {
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

  // ---------- read everything the dashboard needs in one call ----------
  if (action === 'getAll') {
    const [customers, shoots, showReports, pending, lastRun, settings] = await Promise.all([
      getList(store, 'customers'),
      getList(store, 'shoots'),
      getList(store, 'show-reports'),
      store.get('show-search-pending', { type: 'json' }),
      store.get('show-search-last', { type: 'json' }),
      store.get('settings', { type: 'json' })
    ]);
    showReports.sort((a, b) => String(b.ranAt || '').localeCompare(String(a.ranAt || '')));
    return json(200, {
      customers, shoots, showReports,
      pending: pending || null,
      lastRun: lastRun || null,
      settings: settings || {}
    });
  }

  // ---------------------------- settings ----------------------------
  // Currently just the monthly income goal shown on Business Stats. Stored
  // as its own blob so it survives independently of customers/shoots.
  if (action === 'updateSettings') {
    const patch = body.patch || {};
    const current = (await store.get('settings', { type: 'json' })) || {};
    const updated = Object.assign({}, current, patch);
    if (patch.monthlyGoal !== undefined) updated.monthlyGoal = Number(patch.monthlyGoal) || 0;
    await store.setJSON('settings', updated);
    return json(200, { settings: updated });
  }

  // ---------------------------- customers ----------------------------
  if (action === 'addCustomer') {
    const c = body.customer || {};
    if (!c.name || !String(c.name).trim()) return json(400, { error: 'Name is required' });
    const now = new Date().toISOString();
    const record = {
      id: newId('cust'),
      name: String(c.name).trim(),
      instagram: String(c.instagram || '').trim(),
      carInfo: String(c.carInfo || '').trim(),
      contact: String(c.contact || '').trim(),
      metAt: String(c.metAt || '').trim(),
      notes: String(c.notes || '').trim(),
      contacted: !!c.contacted,
      interested: !!c.interested,
      followUpStatus: c.followUpStatus || 'new',
      purchase: c.purchase && c.purchase.amount ? {
        amount: Number(c.purchase.amount) || 0,
        photos: Number(c.purchase.photos) || 0,
        date: c.purchase.date || now
      } : null,
      createdAt: now,
      updatedAt: now
    };
    const list = await getList(store, 'customers');
    list.push(record);
    await store.setJSON('customers', list);
    return json(200, { customer: record });
  }

  if (action === 'updateCustomer') {
    const id = body.id;
    const patch = body.patch || {};
    if (!id) return json(400, { error: 'Missing id' });
    const list = await getList(store, 'customers');
    const idx = list.findIndex(x => x.id === id);
    if (idx === -1) return json(404, { error: 'Customer not found' });
    const existing = list[idx];
    const updated = Object.assign({}, existing, patch, { id: existing.id, updatedAt: new Date().toISOString() });
    if (patch.purchase !== undefined) {
      updated.purchase = (patch.purchase && patch.purchase.amount) ? {
        amount: Number(patch.purchase.amount) || 0,
        photos: Number(patch.purchase.photos) || 0,
        date: patch.purchase.date || new Date().toISOString()
      } : null;
    }
    list[idx] = updated;
    await store.setJSON('customers', list);
    return json(200, { customer: updated });
  }

  if (action === 'deleteCustomer') {
    const id = body.id;
    if (!id) return json(400, { error: 'Missing id' });
    const list = await getList(store, 'customers');
    const next = list.filter(x => x.id !== id);
    await store.setJSON('customers', next);
    return json(200, { ok: true });
  }

  // ----------------------------- shoots -----------------------------
  if (action === 'addShoot') {
    const s = body.shoot || {};
    if (!s.customerName || !String(s.customerName).trim()) return json(400, { error: 'Customer name is required' });
    const now = new Date().toISOString();
    const record = {
      id: newId('shoot'),
      customerName: String(s.customerName).trim(),
      instagram: String(s.instagram || '').trim(),
      contact: String(s.contact || '').trim(),
      vehicle: String(s.vehicle || '').trim(),
      shootDate: s.shootDate || '',
      location: String(s.location || '').trim(),
      price: Number(s.price) || 0,
      paymentStatus: s.paymentStatus || 'unpaid',
      status: s.status || 'inquiry',
      notes: String(s.notes || '').trim(),
      linkedCustomerId: s.linkedCustomerId || null,
      createdAt: now,
      updatedAt: now
    };
    const list = await getList(store, 'shoots');
    list.push(record);
    await store.setJSON('shoots', list);
    return json(200, { shoot: record });
  }

  if (action === 'updateShoot') {
    const id = body.id;
    const patch = body.patch || {};
    if (!id) return json(400, { error: 'Missing id' });
    const list = await getList(store, 'shoots');
    const idx = list.findIndex(x => x.id === id);
    if (idx === -1) return json(404, { error: 'Shoot not found' });
    const existing = list[idx];
    const updated = Object.assign({}, existing, patch, { id: existing.id, updatedAt: new Date().toISOString() });
    if (patch.price !== undefined) updated.price = Number(patch.price) || 0;
    list[idx] = updated;
    await store.setJSON('shoots', list);
    return json(200, { shoot: updated });
  }

  if (action === 'deleteShoot') {
    const id = body.id;
    if (!id) return json(400, { error: 'Missing id' });
    const list = await getList(store, 'shoots');
    const next = list.filter(x => x.id !== id);
    await store.setJSON('shoots', next);
    return json(200, { ok: true });
  }

  // ------------------------- car show search -------------------------
  if (action === 'requestShowSearch') {
    const pending = { requestedAt: new Date().toISOString() };
    await store.setJSON('show-search-pending', pending);
    return json(200, { pending });
  }

  return json(400, { error: 'Unknown action' });
};
