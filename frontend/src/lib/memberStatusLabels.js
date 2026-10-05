// frontend/src/lib/memberStatusLabels.js

// Single source of truth for "what state is this existing member/first-timer in" —
// used by duplicate-detection warnings in AddCareGroupMemberDialog and AddConnectMemberDialog.
// member_status and connection_status are mutually exclusive in practice (see
// memberRepository.js: joinCareGroup clears connection_status; Connect intake never
// sets member_status until then) — so checking member_status first is safe.
export function getDuplicateStatusLabel(match) {
  if (match.member_status === "removed") {
    return { label: "Removed (Care Group archive)", tone: "destructive" };
  }
  if (match.member_status === "mentor") {
    // hybrid: a mentor who is also someone else's mentee (mentor_id set)
    return { label: match.mentor_id ? "Mentor / Mentee" : "Mentor", tone: "neutral" };
  }
  if (match.member_status === "potential mentor") {
    return { label: "Potential Mentor", tone: "neutral" };
  }
  if (match.member_status === "mentee") {
    return { label: "Mentee", tone: "neutral" };
  }
  if (match.connection_status === "removed") {
    return { label: "Removed (Connect archive)", tone: "destructive" };
  }
  if (match.connection_status === "assigned") {
    return { label: "Assigned (Connect)", tone: "neutral" };
  }
  if (match.connection_status === "pending") {
    return { label: "Pending (Connect)", tone: "neutral" };
  }
  return { label: "No status on file", tone: "neutral" };
}