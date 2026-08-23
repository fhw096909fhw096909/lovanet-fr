import { useEffect } from "react";
import { registerWebPushSubscription, unsubscribeWebPushSubscription } from "@/lib/webPush";

export function usePushNotifications() {
  useEffect(() => {
    const syncSubscription = async () => {
      if (!("Notification" in window)) return;

      if (Notification.permission === "granted") {
        try {
          await registerWebPushSubscription(false);
        } catch (err) {
          console.error("Failed to sync Web Push subscription", err);
        }
        return;
      }

      if (Notification.permission === "denied") {
        await unsubscribeWebPushSubscription().catch(() => undefined);
      }
    };

    void syncSubscription();
  }, []);
}
