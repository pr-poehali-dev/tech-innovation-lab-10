const API_URLS = {
  auth: "https://functions.poehali.dev/77230244-86d9-4acc-b538-eac888a09596",
  chats: "https://functions.poehali.dev/5c6f0af5-1b95-4d5a-8af1-f8afa8d358f6",
  upload: "https://functions.poehali.dev/efe5bd58-7c17-47e8-809d-7d9b77e9ae08",
};

export async function apiPost(service: keyof typeof API_URLS, action: string, body: Record<string, unknown>) {
  const res = await fetch(`${API_URLS[service]}?action=${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function apiGet(service: keyof typeof API_URLS, action: string, params: Record<string, string | number>) {
  const query = new URLSearchParams({ action, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  const res = await fetch(`${API_URLS[service]}?${query}`);
  return res.json();
}

export function getUser() {
  const data = localStorage.getItem("bobs_user");
  return data ? JSON.parse(data) : null;
}

export function saveUser(user: { user_id: number; username: string; display_name: string; token: string }) {
  localStorage.setItem("bobs_user", JSON.stringify(user));
}

export function logout() {
  localStorage.removeItem("bobs_user");
  window.location.href = "/login";
}

export default API_URLS;
