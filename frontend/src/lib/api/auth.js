const API_URL = import.meta.env.VITE_API_URL;

export async function loginUser({ username, password }) {
  let res;


  try {
    res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });
  } catch (networkErr) {
    console.error("Network error:", networkErr);
    const err = new Error(
      navigator.onLine
        ? "Cannot reach the server. Is the backend running?"
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
  console.log("Login success response:", data);
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
