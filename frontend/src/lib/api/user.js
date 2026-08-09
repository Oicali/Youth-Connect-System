const API_URL = import.meta.env.VITE_API_URL;

export async function fetchProfile() {
  const res = await fetch(`${API_URL}/users/me`, {
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || "Failed to load profile");
  }
  return res.json();
}

export async function updateProfile(data) {
  const res = await fetch(`${API_URL}/users/me`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || "Failed to update profile");
  }
  return res.json();
}

export async function changePassword(data) {
  const res = await fetch(`${API_URL}/users/me/password`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || "Failed to change password");
  }
  return res.json();
}