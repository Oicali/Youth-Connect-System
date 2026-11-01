// backend/validators/memberValidator.js

const LIMITS = { first_name: 50, last_name: 50, address: 255, main_church: 100, ministry: 100, facebook: 255, instagram: 255 };
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}\s'’.-]*$/u; // letters (incl. ñ), spaces, - ' .
const MOBILE_RE = /^09\d{9}$/;

// throws the same { status, message, field } shape your controller already handles
function fail(field, message) {
  throw { status: 400, message, field };
}

// trims, collapses repeated spaces, enforces required + max length, writes the clean value back
function cleanText(fields, key, label, { required = false } = {}) {
  const raw = fields[key] ?? "";
  if (typeof raw !== "string") fail(key, `${label} is invalid`);
  const value = raw.trim().replace(/\s+/g, " ");
  if (required && !value) fail(key, `${label} is required`);
  if (value.length > LIMITS[key]) fail(key, `${label} must be ${LIMITS[key]} characters or less`);
  fields[key] = value;
  return value;
}

// turns +63917..., 0917 123 4567, 917... into 09XXXXXXXXX; empty -> null; anything else -> 400
function normalizePhone(raw, key, label) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") fail(key, `${label} is invalid`);
  if (raw.trim() === "") return null;
  if (!/^[+\d\s()-]+$/.test(raw.trim())) fail(key, `${label} must contain numbers only`);
  let d = raw.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("63")) d = "0" + d.slice(2);
  else if (d.length === 10 && d.startsWith("9")) d = "0" + d;
  if (!MOBILE_RE.test(d)) fail(key, `${label} must be a mobile number like 09XXXXXXXXX`);
  return d;
}

// validates + normalizes the member fields in place; throws on the first problem
function validateMemberInput(fields) {
  for (const [key, label] of [["first_name", "First name"], ["last_name", "Last name"]]) {
    const value = cleanText(fields, key, label, { required: true });
    if (!NAME_RE.test(value)) fail(key, `${label} can only contain letters, spaces, hyphens, apostrophes and periods`);
  }
  cleanText(fields, "address", "Address");
  cleanText(fields, "main_church", "Main church", { required: true });
  cleanText(fields, "ministry", "Ministry");
  cleanText(fields, "facebook", "Facebook");
  cleanText(fields, "instagram", "Instagram");

  const phone = normalizePhone(fields.phone_num, "phone_num", "Phone");
  const alt = normalizePhone(fields.alt_phone, "alt_phone", "Alternate phone");
  if (alt && !phone) fail("alt_phone", "Enter a phone number first");
  if (alt && alt === phone) fail("alt_phone", "Alternate phone must be different from phone");
  fields.phone_num = phone;
  fields.alt_phone = alt;
}

module.exports = { validateMemberInput, normalizePhone };