// POST { slug, code } -> verifies the access code server-side against the
// salted hash stored in Netlify Blobs (never in git), and returns a
// short-lived signed session token. This is the only place a client's
// access code is ever checked -- there is no client-side password gate.
const { getStore } = require('@netlify/blobs');
const { verifyCode, signToken, json } = require('./_shared');

const TOKEN_LIFETIME_MS = 1000 * 60 * 60 * 12; // 12 hours

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
          return json(405, { error: 'Method not allowed' });
    }

    let body;
    try {
          body = JSON.parse(event.body || '{}');
    } catch (e) {
          return json(400, { error: 'Bad request' });
    }

    const slug = String(body.slug || '').trim().toLowerCase();
    const code = String(body.code || '').trim();
    if (!slug || !code) {
          return json(400, { error: 'Missing gallery link or access code' });
    }

    const store = getStore('galleries');
    const gallery = await store.get('gallery:' + slug, { type: 'json' });

    if (!gallery || gallery.disabled) {
          return json(401, { error: 'Invalid gallery link or access code' });
    }
    if (gallery.expiresAt && Date.now() > new Date(gallery.expiresAt).getTime()) {
          return json(401, { error: 'This gallery link has expired' });
    }

    const ok = verifyCode(code, gallery.accessSalt, gallery.accessHash);
    if (!ok) {
          return json(401, { error: 'Invalid gallery link or access code' });
    }

    const token = signToken({ slug, exp: Date.now() + TOKEN_LIFETIME_MS });
    return json(200, { token, clientName: gallery.clientName });
};
