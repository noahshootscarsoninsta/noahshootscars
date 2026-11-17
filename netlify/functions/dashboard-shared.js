// Shared helpers for the private business dashboard functions
// (car show finder, customer tracker, private shoot tracker, stats).
//
// This dashboard is completely separate from the client-gallery system in
// _shared.js / gallery-auth.js / gallery-admin.js -- it reuses only the
// generic, non-secret helpers (blobStore, json, timingSafeEqual) from that
// file. It never touches GALLERY_ADMIN_KEY and the gallery code never
// touches these keys, so the two systems can't affect each other.
//
// Two secrets, both set in Netlify (Site configuration -> Environment
// variables), never committed to git:
//   DASHBOARD_ADMIN_KEY      - the passcode Shielagh types into /dashboard
//                              in her own browser. Sent as the x-dashboard-key
//                              header on every dashboard-api.js request.
//   DASHBOARD_AUTOMATION_KEY - a machine-only secret used solely by the
//                              scheduled background search job to call
//                              dashboard-automation.js. Never typed by a
//                              person, never sent from the browser.
const { blobStore, json, timingSafeEqual } = require('./_shared');

const ADMIN_SECRET = process.env.DASHBOARD_ADMIN_KEY || '';
const AUTOMATION_SECRET = process.env.DASHBOARD_AUTOMATION_KEY || '';

// Fails closed: if the env var isn't set yet, every request is rejected.
function checkAdminKey(event) {
  if (!ADMIN_SECRET) return false;
  const headers = event.headers || {};
  const provided = headers['x-dashboard-key'] || headers['X-Dashboard-Key'] || '';
  if (!provided) return false;
  return timingSafeEqual(provided, ADMIN_SECRET);
}

function checkAutomationKey(event) {
  if (!AUTOMATION_SECRET) return false;
  const headers = event.headers || {};
  const provided = headers['x-automation-key'] || headers['X-Automation-Key'] || '';
  if (!provided) return false;
  return timingSafeEqual(provided, AUTOMATION_SECRET);
}

function newId(prefix) {
  const rand = Math.random().toString(36).slice(2, 10);
  return (prefix ? prefix + '_' : '') + Date.now().toString(36) + rand;
}

function monthKey(date) {
  const d = date ? new Date(date) : new Date();
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
}

module.exports = {
  blobStore, json,
  checkAdminKey, checkAutomationKey,
  newId, monthKey
};
