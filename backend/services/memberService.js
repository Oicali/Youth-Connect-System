// backend\services\memberService.js
const { randomUUID } = require("crypto");
const memberRepository = require("../repositories/memberRepository");
const r2Storage = require("../lib/r2Storage");
const { processProfilePhoto } = require("../lib/imageProcessor");
const { validateMemberInput } = require("../validators/memberValidator"); // input rules live in the validator

const MEMBER_STATUSES = ["mentor", "potential mentor", "mentee", "removed"];

// maps Postgres unique/CHECK violations to clean API errors; rethrows anything else
function translateDbError(err) {
  if (err.code === "23505") throw { status: 409, message: "A member with these details already exists" };
  if (err.code === "23514") throw { status: 400, message: "One of the values was rejected as invalid" };
  throw err;
}

// swaps a typed church for its existing spelling ("Sm molino" becomes "SM Molino"); a new church is kept, trimmed
async function canonicalizeChurch(fields) {
  const church = (fields.main_church || "").trim();
  if (!church) throw { status: 400, message: "Main church is required", field: "main_church" };
  fields.main_church = (await memberRepository.findCanonicalChurch(church)) || church;
}

// server-side duplicate guard: 409 on an exact name match unless the client confirmed it's a different person
async function checkNameConflict(fields, excludeId = null) {
  if (fields.confirm_different_person === true) return; // strict boolean, "true" strings don't count
  const first = (fields.first_name || "").trim();
  const last = (fields.last_name || "").trim();
  if (!first || !last) return;
  const match = await memberRepository.findExactNameMatch(first, last, excludeId);
  if (match) {
    throw { status: 409, code: "DUPLICATE_NAME", message: "A member with this exact name already exists" };
  }
}

// server-side guard: rejects future added_at, compared as YYYY-MM-DD in PH time
function validateAddedAt(addedAt) {
  if (!addedAt) return;
  const phToday = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(addedAt) || addedAt > phToday) {
    throw { status: 400, message: "Date added cannot be in the future", field: "added_at" };
  }
}

// swaps the internal photo_key for a short-lived signed photo_url (null when no photo)
async function attachPhotoUrl(member) {
  const { photo_key, ...rest } = member;
  return { ...rest, photo_url: photo_key ? await r2Storage.getSignedReadUrl(photo_key) : null };
}

async function getMember(memberId) {
  const member = await memberRepository.findById(memberId);
  if (!member) {
    throw { status: 404, message: "Member not found" };
  }
  return member;
}

// controller-facing version of getMember; internal callers keep the raw row (no signing needed)
async function getMemberDetails(memberId) {
  return attachPhotoUrl(await getMember(memberId));
}

async function listMembers(filters) {
  const { rows, total } = await memberRepository.findAll(filters);
  return { rows: await Promise.all(rows.map(attachPhotoUrl)), total };
}

// recorded churches for the main church suggestions
async function listChurches() {
  return memberRepository.findChurches();
}

// name-only duplicate lookup; excludeId lets the edit modal skip the member being edited
async function findDuplicates(firstName, lastName, excludeId = null) {
  const term = `${(firstName || "").trim()} ${(lastName || "").trim()}`.trim();
  if (term.replace(/\s/g, "").length < 2) return [];
  const matches = await memberRepository.findNameMatches(term, excludeId);
  return Promise.all(matches.map(attachPhotoUrl));
}

async function createMember(fields) {
  validateMemberInput(fields); // normalize + validate before any DB work
  validateAddedAt(fields.added_at);
  await checkNameConflict(fields, null); // exact-name duplicate guard
  await canonicalizeChurch(fields); // one spelling per church

  try {
    return await memberRepository.create(fields);
  } catch (err) {
    translateDbError(err); // clean message for unique/CHECK violations, rethrows the rest
  }
}

async function updateMember(memberId, fields) {
  validateMemberInput(fields); // normalize + validate before any DB work
  validateAddedAt(fields.added_at); // reject future dates before touching the DB

  // only check when the name changed, otherwise pre-existing duplicates could never be edited
  const existing = await getMember(memberId); // 404 early if missing
  const norm = (s) => (s || "").trim().toLowerCase();
  const nameChanged =
    norm(existing.first_name) !== norm(fields.first_name) || norm(existing.last_name) !== norm(fields.last_name);
  if (nameChanged) await checkNameConflict(fields, memberId);
  await canonicalizeChurch(fields); // one spelling per church

  try {
    const updated = await memberRepository.updateById(memberId, fields);
    if (!updated) {
      throw { status: 404, message: "Member not found" };
    }
    return updated;
  } catch (err) {
    translateDbError(err); // clean message for unique/CHECK violations, rethrows the rest
  }
}

async function setMemberStatus(memberId, status, { cascadeUnassignMentees = false } = {}) {
  if (!MEMBER_STATUSES.includes(status)) {
    throw { status: 400, message: "Invalid member status" };
  }

  const existing = await getMember(memberId); // throws 404 if missing, needed to know PRE-change status
  const wasMentor = existing.member_status === "mentor";

  const updated = await memberRepository.setMemberStatus(memberId, status);

  // opt-in only: the remove flow does NOT cascade, only the edit-modal demotion passes true
  if (cascadeUnassignMentees && wasMentor && status !== "mentor") {
    const affected = await memberRepository.unassignAllMenteesOfMentor(memberId);
    updated.unassigned_mentee_count = affected.length;
  }

  return updated;
}

async function assignMentor(menteeId, mentorId) {
  const mentee = await getMember(menteeId); // throws 404 if missing

  if (mentee.member_status === "removed") {
    throw { status: 400, message: "Cannot assign a mentor to a removed member" };
  }

  const mentor = await getMember(mentorId); // throws 404 if missing
  if (mentor.member_status !== "mentor") {
    throw { status: 400, message: "Assigned member is not a mentor", field: "mentor_id" };
  }

  return memberRepository.assignMentor(menteeId, mentorId);
}

async function unassignMentor(menteeId) {
  await getMember(menteeId); // throws 404 if missing
  return memberRepository.unassignMentor(menteeId);
}

// Connect -> CareGroup transition: same mentor validation, also closes the Connect pipeline
async function joinCareGroup(menteeId, mentorId) {
  const mentee = await getMember(menteeId); // throws 404 if missing

  if (mentee.member_status === "removed") {
    throw { status: 400, message: "Cannot assign a mentor to a removed member" };
  }

  const mentor = await getMember(mentorId); // throws 404 if missing
  if (mentor.member_status !== "mentor") {
    throw { status: 400, message: "Assigned member is not a mentor", field: "mentor_id" };
  }

  return memberRepository.joinCareGroup(menteeId, mentorId);
}

// connectors must be an active mentor; gender-match is UI-only
async function assignConnector(memberId, connectorId) {
  await getMember(memberId); // throws 404 if missing
  const connector = await getMember(connectorId); // throws 404 if missing
  if (connector.member_status !== "mentor") {
    throw { status: 400, message: "Assigned connector is not a mentor", field: "connector_id" };
  }
  return memberRepository.assignConnector(memberId, connectorId);
}

async function unassignConnector(memberId) {
  await getMember(memberId); // throws 404 if missing
  return memberRepository.unassignConnector(memberId);
}

async function markConnectionRemoved(memberId) {
  await getMember(memberId); // throws 404 if missing
  return memberRepository.markConnectionRemoved(memberId);
}

// processes + uploads a new photo, then removes the old object only after the DB points at the new one
async function setMemberPhoto(memberId, file) {
  const existing = await getMember(memberId); // 404 early if missing
  if (!file) throw { status: 400, message: "Photo file is required", field: "photo" };

  let processed;
  try {
    processed = await processProfilePhoto(file.buffer);
  } catch {
    throw { status: 400, message: "File is not a valid image", field: "photo" };
  }

  const newKey = `members/${randomUUID()}.webp`;
  await r2Storage.uploadObject(newKey, processed, "image/webp");

  let updated;
  try {
    updated = await memberRepository.updatePhotoKey(memberId, newKey);
  } catch (err) {
    await r2Storage.deleteObject(newKey).catch(() => {}); // don't leave an orphan if the DB write failed
    throw err;
  }

  if (existing.photo_key) {
    await r2Storage.deleteObject(existing.photo_key).catch((e) => console.error("Old photo cleanup failed:", e));
  }
  return attachPhotoUrl(updated);
}

// clears the DB reference first, then deletes the R2 object
async function removeMemberPhoto(memberId) {
  const existing = await getMember(memberId);
  if (!existing.photo_key) return;
  await memberRepository.updatePhotoKey(memberId, null);
  await r2Storage.deleteObject(existing.photo_key).catch((e) => console.error("Photo cleanup failed:", e));
}

module.exports = {
  getMember,
  getMemberDetails,
  setMemberPhoto,
  removeMemberPhoto,
  listMembers,
  createMember,
  updateMember,
  setMemberStatus,
  assignMentor,
  unassignMentor,
  joinCareGroup,
  assignConnector,
  unassignConnector,
  markConnectionRemoved,
  findDuplicates,
  listChurches,
};