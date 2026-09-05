// backend\services\memberService.js
const memberRepository = require("../repositories/memberRepository");

const MEMBER_STATUSES = ["mentor", "potential mentor", "mentee", "removed"];

async function checkPhoneConflicts(phone, altPhone, excludeMemberId = null) {
  const conflicts = await memberRepository.findPhoneConflict(phone, altPhone, excludeMemberId);
  if (conflicts.length === 0) return;

  const conflict = conflicts[0];
  if (conflict.phone_num === phone || conflict.alt_phone === phone) {
    throw { status: 409, message: "This phone number is already registered to another member", field: "phone_num" };
  }
  throw { status: 409, message: "This phone number is already registered to another member", field: "alt_phone" };
}

async function getMember(memberId) {
  const member = await memberRepository.findById(memberId);
  if (!member) {
    throw { status: 404, message: "Member not found" };
  }
  return member;
}

async function listMembers(filters) {
  return memberRepository.findAll(filters);
}

async function createMember(fields) {
  await checkPhoneConflicts(fields.phone_num, fields.alt_phone, null);

  try {
    return await memberRepository.create(fields);
  } catch (err) {
    if (err.code === "23505") {
      throw { status: 409, message: "A member with these details already exists" };
    }
    throw err;
  }
}

async function updateMember(memberId, fields) {
  await checkPhoneConflicts(fields.phone_num, fields.alt_phone, memberId);

  try {
    const updated = await memberRepository.updateById(memberId, fields);
    if (!updated) {
      throw { status: 404, message: "Member not found" };
    }
    return updated;
  } catch (err) {
    if (err.code === "23505") {
      throw { status: 409, message: "A member with these details already exists" };
    }
    throw err;
  }
}

async function setMemberStatus(memberId, status, { cascadeUnassignMentees = false } = {}) {
  if (!MEMBER_STATUSES.includes(status)) {
    throw { status: 400, message: "Invalid member status" };
  }

  const existing = await getMember(memberId); // throws 404 if missing, needed to know PRE-change status
  const wasMentor = existing.member_status === "mentor";

  const updated = await memberRepository.setMemberStatus(memberId, status);

  // opt-in only — the "remove member" flow calls this same function and intentionally
  // does NOT cascade (see CareGroup.jsx remove-confirmation copy). Only the edit-modal
  // demotion path passes cascadeUnassignMentees: true.
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

// Connect -> CareGroup transition: same mentor validation as assignMentor,
// but also closes out the Connect pipeline (connection_status/assigned_to -> NULL)
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

// connectors must be an active mentor — same rule as assignMentor (gender-match
// is UI-only, enforced by the frontend's fetchMembers filter, not here)
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

module.exports = {
  getMember,
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
};