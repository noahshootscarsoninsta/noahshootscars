// POST { name, phone, instagram, email, carInfo, requestType, contactMethod, message, website }
//
// Handles submissions from the custom contact form on /contact.html. For each
// submission this:
//   1. Creates or updates the person as a Contact in GoHighLevel, filling in
//      the 5 custom fields (Instagram Username, Car Year/Make/Model, Type of
//      Request, Preferred Contact Method, Message) that were set up in
//      Settings -> Custom Fields.
//   2. Applies the `website-form-submitted` tag to that contact, which is
//      what fires the "New Inquiry - Contact Form Automation" workflow in
//      GHL (internal email to Shielagh, auto-reply SMS to the contact, and
//      adding them to the Photography Clients pipeline at New Inquiry).
//
// The only secret this needs is GHL_API_KEY -- a GoHighLevel Private
// Integration token -- set in Netlify's dashboard (Site configuration ->
// Environment variables), never committed to git. Same pattern as the
// existing GALLERY_ADMIN_KEY used by the client gallery functions.
const { json } = require('./_shared');

const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-07-28';
const LOCATION_ID = process.env.GHL_LOCATION_ID || 'qv9AucZXN17N46X9qXOj';
const API_KEY = process.env.GHL_API_KEY || '';
const INQUIRY_TAG = 'website-form-submitted';

// Maps our form's field names to the GHL custom field keys (as shown in
// Settings -> Custom Fields, under the Additional Info folder). GHL prefixes
// every contact-level custom field key with "contact." in the fields list.
const CUSTOM_FIELD_KEYS = {
  instagram: 'contact.instagram_username',
  carInfo: 'contact.car_yearmakemodel',
  requestType: 'contact.type_of_request',
  contactMethod: 'contact.preferred_contact_method',
  message: 'contact.message'
};

// Must exactly match the option values configured on the GHL dropdown
// custom fields, and the <option value="..."> attributes in contact.html.
const REQUEST_TYPE_VALUES = new Set(['private_shoot', 'carshow_photos', 'general_question']);
const CONTACT_METHOD_VALUES = new Set(['text', 'instagram', 'email']);

// Custom field IDs are assigned by GHL per-location and aren't predictable,
// so they're looked up here rather than hardcoded -- this also means the
// form keeps working even if a field is ever deleted and recreated. Cached
// in memory for the life of a warm function instance so repeat submissions
// in quick succession don't each pay for an extra API round-trip.
let fieldIdCache = null;
let fieldIdCacheAt = 0;
const FIELD_CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes

async function ghlFetch(path, options) {
  const res = await fetch(GHL_BASE + path, Object.assign({}, options, {
    headers: Object.assign({
      'Authorization': 'Bearer ' + API_KEY,
      'Version': GHL_VERSION,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }, (options && options.headers) || {})
  }));
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { raw: text }; }
  if (!res.ok) {
    const err = new Error((data && (data.message || data.error)) || ('GHL API error ' + res.status));
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function getFieldIdMap() {
  if (fieldIdCache && (Date.now() - fieldIdCacheAt) < FIELD_CACHE_TTL_MS) {
    return fieldIdCache;
  }
  const data = await ghlFetch('/locations/' + LOCATION_ID + '/customFields?model=contact', { method: 'GET' });
  const byKey = {};
  (data.customFields || []).forEach(f => { byKey[f.fieldKey] = f.id; });
  fieldIdCache = byKey;
  fieldIdCacheAt = Date.now();
  return byKey;
}

function splitName(fullName) {
  const trimmed = String(fullName || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return { firstName: '', lastName: '' };
  const parts = trimmed.split(' ');
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }
  if (!API_KEY) {
    console.error('GHL_API_KEY is not configured in Netlify environment variables');
    return json(500, { error: "The contact form isn't fully set up yet. Please message Noah directly on Instagram in the meantime." });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Bad request' });
  }

  // Honeypot: a field real visitors never see or fill in (hidden via CSS).
  // If it has a value, this is almost certainly a bot -- pretend success so
  // it doesn't learn to avoid the trap, but skip actually contacting GHL.
  if (body.website) {
    return json(200, { ok: true });
  }

  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();
  const email = String(body.email || '').trim();
  const instagram = String(body.instagram || '').trim();
  const carInfo = String(body.carInfo || '').trim();
  const requestType = String(body.requestType || '').trim();
  const contactMethod = String(body.contactMethod || '').trim();
  const message = String(body.message || '').trim();

  if (!name) return json(400, { error: 'Please enter your name.' });
  if (!phone && !email) return json(400, { error: 'Please enter a phone number or email so Noah can reach you.' });
  if (!REQUEST_TYPE_VALUES.has(requestType)) return json(400, { error: 'Please choose a type of request.' });
  if (!CONTACT_METHOD_VALUES.has(contactMethod)) return json(400, { error: 'Please choose a preferred contact method.' });
  if (!message) return json(400, { error: 'Please add a short message.' });
  if (contactMethod === 'text' && !phone) return json(400, { error: 'A phone number is needed to contact you by text.' });
  if (contactMethod === 'email' && !email) return json(400, { error: 'An email address is needed to contact you by email.' });

  const { firstName, lastName } = splitName(name);

  try {
    const fieldIds = await getFieldIdMap();
    const customFields = [];
    const addField = (formKey, value) => {
      const id = fieldIds[CUSTOM_FIELD_KEYS[formKey]];
      if (id && value) customFields.push({ id, field_value: value });
    };
    addField('instagram', instagram);
    addField('carInfo', carInfo);
    addField('requestType', requestType);
    addField('contactMethod', contactMethod);
    addField('message', message);

    const upsertBody = {
      locationId: LOCATION_ID,
      firstName,
      lastName,
      name,
      source: 'Website Contact Form',
      customFields
    };
    if (email) upsertBody.email = email;
    if (phone) upsertBody.phone = phone;

    const upsertResult = await ghlFetch('/contacts/upsert', {
      method: 'POST',
      body: JSON.stringify(upsertBody)
    });

    const contact = upsertResult.contact || upsertResult;
    const contactId = contact && contact.id;
    if (!contactId) throw new Error('GHL did not return a contact id');

    // Remove then re-add the tag so a fresh "Tag added" event fires on
    // every submission -- including a second inquiry from someone who
    // already carries this tag from a previous visit. Without this, the
    // GHL trigger wouldn't refire for repeat contacts (it only fires on the
    // transition from "tag absent" to "tag present"), so the notification,
    // auto-reply text, and pipeline card wouldn't happen for their new ask.
    try {
      await ghlFetch('/contacts/' + contactId + '/tags', {
        method: 'DELETE',
        body: JSON.stringify({ tags: [INQUIRY_TAG] })
      });
    } catch (e) {
      // Non-fatal -- e.g. this contact never had the tag before.
    }
    await ghlFetch('/contacts/' + contactId + '/tags', {
      method: 'POST',
      body: JSON.stringify({ tags: [INQUIRY_TAG] })
    });

    return json(200, { ok: true });
  } catch (e) {
    console.error('contact-submit error:', e && e.message, e && e.data);
    return json(502, { error: 'Something went wrong sending your request. Please try again, or message Noah directly on Instagram.' });
  }
};
