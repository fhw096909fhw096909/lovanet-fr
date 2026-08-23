import { useEffect, useRef } from "react";

export function usePushNotifications() {
  const lastCheck = useRef<string | null>(null);

  useEffect(() => {
    // Check permission
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }

    const checkNews = async () => {
      if (!("Notification" in window) || Notification.permission !== "granted") return;

      try {
        const backendUrl = (import.meta.env.VITE_BACKEND_URL ?? "") || "";
        const res = await fetch(`${backendUrl}/api/news/home`);
        if (!res.ok) return;
        const data = await res.json();
        
        const latestTime = data.updated_at;
        const savedTime = localStorage.getItem("lovanet.lastNewsUpdate");
        
        if (savedTime && latestTime && latestTime !== savedTime) {
          // Find if there's a specific new item
          const firstItem = data.items?.[0];
          if (firstItem) {
            new Notification("Nouveau contenu sur Lovanet !", {
              body: firstItem.title,
              icon: "/lovanet-icon-192.png?v=19",
              badge: "/lovanet-icon-64.png?v=19",
            });
          }
        }
        
        if (latestTime) {
          localStorage.setItem("lovanet.lastNewsUpdate", latestTime);
        }
      } catch (err) {
        console.error("Failed to check news for notifications", err);
      }
    };

    // Check once on load
    checkNews();

    // Then check every 5 minutes
    const interval = setInterval(checkNews, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
}
