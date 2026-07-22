// POST { slug, token, filenames: [...] } -> lets a client pick which of
// their preview photos they want edited as finals, for packages that offer
// a "pick N of M" allowance (e.g. "edit 10, choose 5 as finals"). Picks can
// be changed anytime by resubmitting -- whatever is currently selected is
// what gets delivered once the gallery is paid and downloads are unlocked,
// so there's no awkward "locked out" state if payment happens before the
// client finishes choosing.
const { verifyToken, json, blobStore } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Bad request' });
  }

  const slug = String(body.slug || '').trim().toLowerCase();
  const token = body.token || '';
  const filenames = Array.isArray(body.filenames) ? body.filenames.map(String) : [];

  const payload = verifyToken(token);
  if (!payload || payload.slug !== slug) {
    return json(401, { error: 'Not authorized' });
  }

  const store = blobStore('galleries');
  const gallery = await store.get('gallery:' + slug, { type: 'json' });
  if (!gallery || gallery.disabled) return json(404, { error: 'Gallery not found' });
  if (gallery.expiresAt && Date.now() > new Date(gallery.expiresAt).getTime()) {
    return json(401, { error: 'This gallery link has expired' });
  }

  const chooseCount = gallery.package && gallery.package.chooseCount;
  if (!chooseCount) {
    return json(400, { error: 'This gallery does not require picking favorites' });
  }

  const uniqueNames = Array.from(new Set(filenames));
  if (uniqueNames.length !== chooseCount) {
    return json(400, { error: 'Please pick exactly ' + chooseCount + ' photos' });
  }
  const validNames = new Set((gallery.previewImages || []).map(p => p.filename));
  if (!uniqueNames.every(f => validNames.has(f))) {
    return json(400, { error: 'One or more selected photos were not found in this gallery' });
  }

  gallery.selectedFilenames = uniqueNames;
  gallery.selectionSubmittedAt = new Date().toISOString();
  await store.setJSON('gallery:' + slug, gallery);

  return json(200, { ok: true, selectedFilenames: gallery.selectedFilenames });
};
