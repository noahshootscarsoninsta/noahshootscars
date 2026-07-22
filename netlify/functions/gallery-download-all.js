// GET ?slug=&token= -> zips every deliverable final photo and streams it as
// one download. For "pick N of M" packages, only the client's chosen
// favorites are ever deliverable -- see deliverableFinals() in _shared.js.
// Netlify's synchronous functions cap response payloads at a few MB, so this
// is best-effort for smaller galleries; the gallery page always also offers
// per-photo download links (via gallery-image.js) which have no such cap.
const { verifyToken, blobStore, deliverableFinals } = require('./_shared');
const { buildZip } = require('./_zip');

const MAX_ZIP_INPUT_BYTES = 4 * 1024 * 1024; // stay safely under the ~6MB function response cap after base64 overhead

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' };

  const params = event.queryStringParameters || {};
  const slug = String(params.slug || '').trim().toLowerCase();
  const token = params.token || '';

  const payload = verifyToken(token);
  if (!payload || payload.slug !== slug) {
    return { statusCode: 401, body: 'Not authorized' };
  }

  const metaStore = blobStore('galleries');
  const gallery = await metaStore.get('gallery:' + slug, { type: 'json' });
  if (!gallery || gallery.disabled) return { statusCode: 404, body: 'Not found' };
  if (!(gallery.paid && !gallery.downloadsLocked)) {
    return { statusCode: 403, body: 'Downloads are not available yet' };
  }

  const finals = deliverableFinals(gallery);
  if (!finals.length) return { statusCode: 404, body: 'No final photos yet' };

  const imgStore = blobStore('gallery-images');
  const files = [];
  let total = 0;
  for (const f of finals) {
    const data = await imgStore.get(slug + '/final/' + f.filename, { type: 'arrayBuffer' });
    if (!data) continue;
    const buf = Buffer.from(data);
    total += buf.length;
    if (total > MAX_ZIP_INPUT_BYTES) {
      return {
        statusCode: 413,
        body: 'This gallery is too large to zip in one download -- please download photos individually below.'
      };
    }
    files.push({ name: f.filename, data: buf });
  }
  if (!files.length) return { statusCode: 404, body: 'No final photos yet' };

  const zipBuf = buildZip(files);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="' + slug + '-photos.zip"',
      'Cache-Control': 'no-store'
    },
    body: zipBuf.toString('base64'),
    isBase64Encoded: true
  };
};
