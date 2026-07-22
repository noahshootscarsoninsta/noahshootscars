// GET ?slug=&token= -> gallery details for an already-authenticated session.
// Final (full-quality) images are only ever included in the response once
// paid === true and downloadsLocked === false, checked server-side here.
const { verifyToken, json, blobStore } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const params = event.queryStringParameters || {};
  const slug = String(params.slug || '').trim().toLowerCase();
  const token = params.token || '';

  const payload = verifyToken(token);
  if (!payload || payload.slug !== slug) {
    return json(401, { error: 'Not authorized' });
  }

  const store = blobStore('galleries');
  const gallery = await store.get('gallery:' + slug, { type: 'json' });
  if (!gallery || gallery.disabled) {
    return json(404, { error: 'Gallery not found' });
  }
  if (gallery.expiresAt && Date.now() > new Date(gallery.expiresAt).getTime()) {
    return json(401, { error: 'This gallery link has expired' });
  }

  const canDownload = !!gallery.paid && !gallery.downloadsLocked;
  const imgUrl = (set, filename) =>
    '/.netlify/functions/gallery-image?slug=' + encodeURIComponent(slug) +
    '&token=' + encodeURIComponent(token) +
    '&set=' + set + '&file=' + encodeURIComponent(filename);

  return json(200, {
    slug: gallery.slug,
    clientName: gallery.clientName,
    description: gallery.description || '',
    price: gallery.price || '',
    package: gallery.package || null,
    paymentInstructions: gallery.paymentInstructions || '',
    paid: !!gallery.paid,
    canDownload,
    previewImages: (gallery.previewImages || []).map(p => ({
      filename: p.filename,
      url: imgUrl('preview', p.filename)
    })),
    finalImages: canDownload ? (gallery.finalImages || []).map(f => ({
      filename: f.filename,
      url: imgUrl('final', f.filename)
    })) : []
  });
};
