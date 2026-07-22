// GET ?slug=&token=&set=preview|final&file=
// Streams a single image out of Netlify Blobs. There is no public URL to
// any gallery photo -- every request is re-checked against the signed
// session token, and "final" (full-quality) images additionally require
// paid === true and downloadsLocked === false, checked fresh every time
// (not just at login), so revoking access or locking downloads takes
// effect immediately.
const { verifyToken, blobStore } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' };

  const params = event.queryStringParameters || {};
  const slug = String(params.slug || '').trim().toLowerCase();
  const set = params.set === 'final' ? 'final' : 'preview';
  const file = params.file || '';
  const token = params.token || '';

  const payload = verifyToken(token);
  if (!payload || payload.slug !== slug || !file) {
    return { statusCode: 401, body: 'Not authorized' };
  }

  const metaStore = blobStore('galleries');
  const gallery = await metaStore.get('gallery:' + slug, { type: 'json' });
  if (!gallery || gallery.disabled) return { statusCode: 404, body: 'Not found' };
  if (gallery.expiresAt && Date.now() > new Date(gallery.expiresAt).getTime()) {
    return { statusCode: 401, body: 'Expired' };
  }
  if (set === 'final' && !(gallery.paid && !gallery.downloadsLocked)) {
    return { statusCode: 403, body: 'Not available yet' };
  }

  const list = set === 'final' ? (gallery.finalImages || []) : (gallery.previewImages || []);
  const match = list.find(item => item.filename === file);
  if (!match) return { statusCode: 404, body: 'Not found' };

  const imgStore = blobStore('gallery-images');
  const data = await imgStore.get(slug + '/' + set + '/' + file, { type: 'arrayBuffer' });
  if (!data) return { statusCode: 404, body: 'Not found' };

  return {
    statusCode: 200,
    headers: {
      'Content-Type': match.contentType || 'image/jpeg',
      'Cache-Control': 'private, max-age=300',
      'Content-Disposition': set === 'final' ? ('attachment; filename="' + file + '"') : 'inline'
    },
    body: Buffer.from(data).toString('base64'),
    isBase64Encoded: true
  };
};
