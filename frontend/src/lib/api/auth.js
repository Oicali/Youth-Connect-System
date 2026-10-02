// frontend/src/lib/api/auth.js

const API_URL = import.meta.env.VITE_API_URL;

export async function loginUser({ username, password, rememberMe }) {
  let res;

  try {
    res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password, rememberMe }),
    });
    
  } catch (networkErr) {
    console.error("Network error:", networkErr);
    const err = new Error(
      navigator.onLine
        ? "Cannot reach the server. Please try again later."
        : "You appear to be offline. Check your internet connection.",
      { cause: networkErr }
    );
    err.type = "network";
    throw err;
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    console.error("Backend responded with error:", res.status, errorBody);
    const err = new Error(
      errorBody?.message || `Login failed (status ${res.status})`,
      { cause: errorBody }
    );
    err.type = res.status >= 500 ? "server" : "client";
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  return data;
}

export async function logoutUser() {
  const res = await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to log out");
  return res.json();
}

// shared helper for POST endpoints, throws errors typed network/server/client like loginUser
async function postJson(path, body) {
  let res;

  try {
    res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    const err = new Error(
      navigator.onLine
        ? "Cannot reach the server. Please try again later."
        : "You appear to be offline. Check your internet connection.",
      { cause: networkErr }
    );
    err.type = "network";
    throw err;
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const err = new Error(data?.message || `Request failed (status ${res.status})`, {
      cause: data,
    });
    err.type = res.status >= 500 ? "server" : "client";
    err.status = res.status;
    throw err;
  }

  return data;
}

// asks the backend to email a reset link
export function forgotPassword(email) {
  return postJson("/auth/forgot-password", { email });
}

// submits the token from the email link plus the new password
export function resetPassword({ token, password }) {
  return postJson("/auth/reset-password", { token, password });
}
