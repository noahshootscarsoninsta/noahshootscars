// All gallery-management actions (create/update/upload/paid/disable/delete)
// go through this one function, gated by the x-admin-key header matching the
// GALLERY_ADMIN_KEY environment variable. This is the ONLY way gallery
// records get created or changed -- there is no git-based / Decap CMS path
// for galleries, on purpose, because Decap commits land in the public repo
// and access codes must never be committed to git, even hashed.
const crypto = require('crypto');
const { checkAdminKey, hashCode, makeSalt, json, blobStore } = require('./_shared');

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

// Canonical package list -- kept server-side so a client can only ever
// attach a real, priced package to a gallery (never an arbitrary made-up
// price/photo-count combo). Mirrors the Pricing page.
const PACKAGES = [
  { id: 'car-50', category: 'Car Photography', price: '$50', editedCount: 5, chooseCount: null, label: 'Car — $50 (5 edited photos)' },
  { id: 'car-65', category: 'Car Photography', price: '$65', editedCount: 10, chooseCount: 5, label: 'Car — $65 (edit 10, choose 5 as finals)' },
  { id: 'car-80', category: 'Car Photography', price: '$80', editedCount: 10, chooseCount: null, label: 'Car — $80, Most Popular (10 edited photos)' },
  { id: 'car-100', category: 'Car Photography', price: '$100', editedCount: 15, chooseCount: 10, label: 'Car — $100 (edit 15, choose 10 as finals)' },
  { id: 'action-75', category: 'Action Photography', price: '$75', editedCount: 5, chooseCount: null, label: 'Action — $75 (5 edited photos)' },
  { id: 'action-120', category: 'Action Photography', price: '$120', editedCount: 10, chooseCount: null, label: 'Action — $120, Most Popular (10 edited photos)' },
  { id: 'action-160', category: 'Action Photography', price: '$160', editedCount: 15, chooseCount: null, label: 'Action — $160 (15 edited photos)' }
];
function findPackage(id) {
  return PACKAGES.find(p => p.id === id) || null;
}

function slugify(name) {
  const base = String(name || 'client')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40) || 'client';
  const code = crypto.randomBytes(3).toString('hex');
  return base + '-' + code;
}

function stripSecrets(gallery) {
  const { accessHash, accessSalt, ...safe } = gallery;
  return safe;
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

  const store = blobStore('galleries');
  const imgStore = blobStore('gallery-images');
  const action = body.action;

  if (action === 'packages') {
    return json(200, { packages: PACKAGES });
  }

  if (action === 'list') {
    const { blobs } = await store.list({ prefix: 'gallery:' });
    const galleries = [];
    for (const b of blobs) {
      const g = await store.get(b.key, { type: 'json' });
      if (g) galleries.push(stripSecrets(g));
    }
    galleries.sort((a, b2) => String(b2.createdAt || '').localeCompare(String(a.createdAt || '')));
    return json(200, { galleries });
  }

  if (action === 'getImage') {
    const slug0 = String(body.slug || '').trim().toLowerCase();
    const set0 = body.set === 'final' ? 'final' : 'preview';
    const filename0 = body.filename || '';
    if (!slug0 || !filename0) return json(400, { error: 'Missing slug or filename' });
    const data = await imgStore.get(slug0 + '/' + set0 + '/' + filename0, { type: 'arrayBuffer' });
    if (!data) return json(404, { error: 'Not found' });
    const g0 = await store.get('gallery:' + slug0, { type: 'json' });
    const meta = g0 && (g0[set0 === 'final' ? 'finalImages' : 'previewImages'] || []).find(i => i.filename === filename0);
    const contentType = (meta && meta.contentType) || 'image/jpeg';
    return json(200, { dataUrl: 'data:' + contentType + ';base64,' + Buffer.from(data).toString('base64') });
  }

  if (action === 'create') {
    const clientName = String(body.clientName || '').trim();
    const code = String(body.code || '').trim();
    if (!clientName || !code) return json(400, { error: 'Client name and access code are required' });
    if (code.length < 4) return json(400, { error: 'Access code should be at least 4 characters' });

    const pkg = findPackage(body.packageId);

    let slug = String(body.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/(^-|-$)/g, '');
    if (!slug) slug = slugify(clientName);
    const existing = await store.get('gallery:' + slug, { type: 'json' });
    if (existing) return json(409, { error: 'That gallery link is already in use -- try a different name' });

    const salt = makeSalt();
    const gallery = {
      slug,
      clientName,
      createdAt: new Date().toISOString(),
      description: body.description || '',
      package: pkg,
      price: pkg ? pkg.price : (body.price || ''),
      paymentInstructions: body.paymentInstructions || '',
      paid: false,
      downloadsLocked: true,
      disabled: false,
      expiresAt: body.expiresAt || null,
      accessSalt: salt,
      accessHash: hashCode(code, salt),
      previewImages: [],
      finalImages: []
    };
    await store.setJSON('gallery:' + slug, gallery);
    return json(200, { gallery: stripSecrets(gallery) });
  }

  // Every action below this line targets an existing gallery.
  const slug = String(body.slug || '').trim().toLowerCase();
  if (!slug) return json(400, { error: 'Missing slug' });
  const gallery = await store.get('gallery:' + slug, { type: 'json' });
  if (!gallery) return json(404, { error: 'Gallery not found' });

  if (action === 'update') {
    if (body.clientName !== undefined) gallery.clientName = body.clientName;
    if (body.description !== undefined) gallery.description = body.description;
    if (body.packageId !== undefined) {
      const pkg = findPackage(body.packageId);
      gallery.package = pkg;
      if (pkg) gallery.price = pkg.price;
    } else if (body.price !== undefined) {
      gallery.price = body.price;
    }
    if (body.paymentInstructions !== undefined) gallery.paymentInstructions = body.paymentInstructions;
    if (body.expiresAt !== undefined) gallery.expiresAt = body.expiresAt;
    if (body.clearSelection) {
      // Lets the photographer reset a client's "pick your favorites"
      // choices, e.g. if the client wants a do-over before finals are sent.
      gallery.selectedFilenames = [];
      delete gallery.selectionSubmittedAt;
    }
    if (body.code) {
      if (String(body.code).length < 4) return json(400, { error: 'Access code should be at least 4 characters' });
      const salt = makeSalt();
      gallery.accessSalt = salt;
      gallery.accessHash = hashCode(body.code, salt);
    }
    await store.setJSON('gallery:' + slug, gallery);
    return json(200, { gallery: stripSecrets(gallery) });
  }

  if (action === 'setPaid') {
    gallery.paid = !!body.paid;
    if (gallery.paid && body.unlockDownloads !== false) gallery.downloadsLocked = false;
    if (!gallery.paid) gallery.downloadsLocked = true;
    await store.setJSON('gallery:' + slug, gallery);
    return json(200, { gallery: stripSecrets(gallery) });
  }

  if (action === 'setDownloadsLocked') {
    gallery.downloadsLocked = !!body.locked;
    await store.setJSON('gallery:' + slug, gallery);
    return json(200, { gallery: stripSecrets(gallery) });
  }

  if (action === 'setDisabled') {
    gallery.disabled = !!body.disabled;
    await store.setJSON('gallery:' + slug, gallery);
    return json(200, { gallery: stripSecrets(gallery) });
  }

  if (action === 'delete') {
    for (const img of gallery.previewImages || []) {
      await imgStore.delete(slug + '/preview/' + img.filename);
    }
    for (const img of gallery.finalImages || []) {
      await imgStore.delete(slug + '/final/' + img.filename);
    }
    await store.delete('gallery:' + slug);
    return json(200, { ok: true });
  }

  if (action === 'uploadImage') {
    const set = body.set === 'final' ? 'final' : 'preview';
    const filename = String(body.filename || ('photo-' + Date.now() + '.jpg')).replace(/[^a-zA-Z0-9_.-]+/g, '-');
    const dataUrl = body.dataUrl || '';
    const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
    if (!match) return json(400, { error: 'Bad image data' });
    const contentType = match[1];
    const buf = Buffer.from(match[2], 'base64');
    if (buf.length > MAX_IMAGE_BYTES) return json(413, { error: 'Image too large (20MB max)' });

    await imgStore.set(slug + '/' + set + '/' + filename, buf);
    const listKey = set === 'final' ? 'finalImages' : 'previewImages';
    gallery[listKey] = (gallery[listKey] || []).filter(i => i.filename !== filename);
    gallery[listKey].push({ filename, contentType, size: buf.length });
    await store.setJSON('gallery:' + slug, gallery);
    return json(200, { gallery: stripSecrets(gallery) });
  }

  if (action === 'deleteImage') {
    const set = body.set === 'final' ? 'final' : 'preview';
    const filename = body.filename;
    const listKey = set === 'final' ? 'finalImages' : 'previewImages';
    gallery[listKey] = (gallery[listKey] || []).filter(i => i.filename !== filename);
    await imgStore.delete(slug + '/' + set + '/' + filename);
    await store.setJSON('gallery:' + slug, gallery);
    return json(200, { gallery: stripSecrets(gallery) });
  }

  return json(400, { error: 'Unknown action' });
};
