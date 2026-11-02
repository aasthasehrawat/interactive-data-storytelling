const TOKEN_KEY = "ids_token";
const USER_KEY = "ids_user";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch (err) {
    return null;
  }
}

export function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function api(path, options = {}) {
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(path, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || "Request failed");
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

export function wsUrl() {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  if (window.location.port === "3000") {
    return `${protocol}://${window.location.hostname}:5000/ws`;
  }
  return `${protocol}://${window.location.host}/ws`;
}
