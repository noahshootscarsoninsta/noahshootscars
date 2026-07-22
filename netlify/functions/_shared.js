// Shared helpers for the private client gallery functions.
// Nothing secret ever lives in git -- the only secret this whole system
// needs is the GALLERY_ADMIN_KEY environment variable, set in the Netlify
// dashboard (Site configuration -> Environment variables), never committed.
const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');

const SECRET = process.env.GALLERY_ADMIN_KEY || '';

// Netlify normally auto-configures Blobs storage for deployed functions by
// injecting context behind the scenes. Some deploy setups (for example, a
// site whose Base/Functions directory was customized after the fact) don't
// get that automatic wiring and throw "MissingBlobsEnvironmentError" instead.
// BLOBS_SITE_ID + BLOBS_TOKEN, if set in Netlify's Environment variables,
// let us configure the store manually as a reliable fallback -- BLOBS_SITE_ID
// is the Site ID from Site configuration -> General -> Site details, and
// BLOBS_TOKEN is a Personal access token from User settings -> Applications.
function blobStore(name) {
  if (process.env.BLOBS_SITE_ID && process.env.BLOBS_TOKEN) {
    return getStore({ name, siteID: process.env.BLOBS_SITE_ID, token: process.env.BLOBS_TOKEN });
  }
  return getStore(name);
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Checks the x-admin-key header on requests to the gallery-admin function.
// Fails closed: if the env var isn't set yet, every request is rejected.
function checkAdminKey(event) {
  if (!SECRET) return false;
  const headers = event.headers || {};
  const provided = headers['x-admin-key'] || headers['X-Admin-Key'] || '';
  if (!provided) return false;
  return timingSafeEqual(provided, SECRET);
}

function makeSalt() {
  return crypto.randomBytes(16).toString('hex');
}

// scrypt is built into Node -- no extra dependency needed for password hashing.
function hashCode(code, salt) {
  return crypto.scryptSync(String(code), salt, 64).toString('hex');
}

function verifyCode(code, salt, hash) {
  if (!salt || !hash) return false;
  const test = hashCode(code, salt);
  return timingSafeEqual(test, hash);
}

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

// Short-lived signed session tokens (HMAC-SHA256), scoped to one gallery slug.
// Not a cookie/JWT library -- just enough to prove "this browser already typed
// the right access code for this gallery, recently" on every follow-up request.
function signToken(payload) {
  if (!SECRET) throw new Error('GALLERY_ADMIN_KEY is not configured');
  const body = base64url(Buffer.from(JSON.stringify(payload)));
  const sig = base64url(crypto.createHmac('sha256', SECRET).update(body).digest());
  return body + '.' + sig;
}

function verifyToken(token) {
  if (!SECRET || !token || typeof token !== 'string' || token.indexOf('.') === -1) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expectedSig = base64url(crypto.createHmac('sha256', SECRET).update(body).digest());
  if (!timingSafeEqual(sig, expectedSig)) return null;
  let payload;
  try {
    payload = JSON.parse(base64urlDecode(body).toString('utf8'));
  } catch (e) {
    return null;
  }
  if (!payload || !payload.exp || Date.now() > payload.exp) return null;
  return payload;
}

function json(statusCode, data, extraHeaders) {
  return {
    statusCode,
    headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, extraHeaders || {}),
    body: JSON.stringify(data)
  };
}

module.exports = {
  checkAdminKey, hashCode, makeSalt, verifyCode, signToken, verifyToken, json, timingSafeEqual, SECRET, blobStore
};
