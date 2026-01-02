import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { registerPushToken } from "../api/push";

const DAILY_REMINDER_TYPE = "daily_time_report_reminder";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const getProjectId = () => {
  return (
    Constants?.expoConfig?.extra?.eas?.projectId ||
    Constants?.easConfig?.projectId ||
    null
  );
};

const ensureAndroidChannel = async () => {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("reminders", {
    name: "Påminnelser",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#3b82f6",
  });
};

const scheduleDailyTimeReportReminders = async () => {
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = existing
    .filter((item) => item.content?.data?.type === DAILY_REMINDER_TYPE)
    .map((item) => item.identifier);
  await Promise.all(toCancel.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
};

export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    return null;
  }

  await ensureAndroidChannel();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const request = await Notifications.requestPermissionsAsync();
    finalStatus = request.status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  await scheduleDailyTimeReportReminders();

  const projectId = getProjectId();
  let token = null;
  try {
    const tokenResponse = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    token = tokenResponse?.data || null;
  } catch (err) {
    console.warn("Expo push token error:", err?.message || err);
    return null;
  }

  if (!token) {
    console.warn("Missing Expo push token.");
    return null;
  }

  await registerPushToken(token, Platform.OS);
  return token;
}
