// frontend/src/lib/memberStatusLabels.js

// Single source of truth for "what state is this existing member/first-timer in" —
// used by duplicate-detection warnings in AddCareGroupMemberDialog and AddConnectMemberDialog.
// member_status and connection_status are mutually exclusive in practice (see
// memberRepository.js: joinCareGroup clears connection_status; Connect intake never
// sets member_status until then) — so checking member_status first is safe.
// badge colors per member_status: tinted bg + readable text in both light and dark
// muted dark-mode badges: deeper -400 text, faint /10 tint
export const MEMBER_STATUS_BADGE = {
  mentor: "bg-amber-500/10 text-amber-700 dark:text-amber-500",
  "potential mentor": "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  mentee: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
};

// icon text colors per member_status, from the --status-* tokens in index.css
export const MEMBER_STATUS_ICON = {
  mentor: "text-status-mentor",
  "potential mentor": "text-status-potential",
  mentee: "text-status-mentee",
};

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