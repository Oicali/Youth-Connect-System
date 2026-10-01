// frontend/src/lib/api/members.js
const API_URL = import.meta.env.VITE_API_URL;

// signal is optional, so existing callers (modals) keep working without it
export async function fetchMembers({ search, role, gender, connectionStatus, hasAssigned, addedYear, addedMonth, sort, page = 1, limit = 15, signal } = {}) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (role && role !== "all") {
    params.set("role", Array.isArray(role) ? role.join(",") : role);
  }
  if (gender && gender !== "all") params.set("gender", gender);
  if (connectionStatus && connectionStatus !== "all") params.set("connectionStatus", connectionStatus);
  if (hasAssigned !== undefined) params.set("hasAssigned", hasAssigned);
  if (addedYear) params.set("addedYear", addedYear);
  if (addedMonth) params.set("addedMonth", addedMonth);
  if (sort) params.set("sort", sort);
  params.set("page", page);
  params.set("limit", limit);

  // passing the signal lets the caller cancel this request mid-flight
  const res = await fetch(`${API_URL}/members?${params.toString()}`, {
    credentials: "include",
    signal,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || "Failed to load members");
  }
  return res.json(); // { members, total }
}

export async function createMember(data) {
  const res = await fetch(`${API_URL}/members`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const err = new Error(body?.message || "Failed to create member");
    err.field = body?.field;
    throw err;
  }
  return res.json(); // { member }
}



export async function updateMember(id, data) {
  const res = await fetch(`${API_URL}/members/${id}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const err = new Error(body?.message || "Failed to update member");
    err.field = body?.field;
    throw err;
  }
  return res.json(); // { member }
}

export async function setMemberStatus(id, memberStatus, { cascadeUnassignMentees = false } = {}) {
  const res = await fetch(`${API_URL}/members/${id}/status`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      member_status: memberStatus,
      cascade_unassign_mentees: cascadeUnassignMentees,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || "Failed to update status");
  }
  return res.json(); // { member }
}

export async function assignMentor(menteeId, mentorId) {
  const res = await fetch(`${API_URL}/members/${menteeId}/mentor`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mentor_id: mentorId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const err = new Error(body?.message || "Failed to assign mentor");
    err.field = body?.field;
    throw err;
  }
  return res.json();
}

export async function unassignMentor(menteeId) {
  const res = await fetch(`${API_URL}/members/${menteeId}/mentor`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || "Failed to unassign mentor");
  }
  return res.json();
}

export async function joinCareGroup(menteeId, mentorId) {
  const res = await fetch(`${API_URL}/members/${menteeId}/join-care-group`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mentor_id: mentorId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const err = new Error(body?.message || "Failed to add to care group");
    err.field = body?.field;
    throw err;
  }
  return res.json(); // { member }
}

export async function assignConnector(memberId, connectorId) {
  const res = await fetch(`${API_URL}/members/${memberId}/connector`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ connector_id: connectorId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || "Failed to assign connector");
  }
  return res.json(); // { member }
}

export async function unassignConnector(memberId) {
  const res = await fetch(`${API_URL}/members/${memberId}/connector`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || "Failed to unassign connector");
  }
  return res.json(); // { member }
}

export async function markConnectionRemoved(memberId) {
  const res = await fetch(`${API_URL}/members/${memberId}/connection/remove`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || "Failed to mark as removed");
  }
  return res.json(); // { member }
}