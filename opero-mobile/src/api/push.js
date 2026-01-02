import { apiFetch } from "./apiClient";

export function registerPushToken(token, platform) {
  return apiFetch("/push/register", {
    method: "POST",
    body: { token, platform },
  });
}

export function unregisterPushToken(token) {
  return apiFetch("/push/register", {
    method: "DELETE",
    body: { token },
  });
}

export function sendPushToUsers(userIds, message, title = "Tidrapportering") {
  return apiFetch("/admin/push/send", {
    method: "POST",
    body: {
      user_ids: userIds,
      title,
      body: message,
    },
  });
}
