import { useEffect, useRef } from "react";

export function usePushNotifications() {
  const lastCheck = useRef<string | null>(null);

  useEffect(() => {
    const checkNews = async () => {
      if (!("Notification" in window) || Notification.permission !== "granted") return;

      try {
        const backendUrl = process.env.REACT_APP_BACKEND_URL || "";
        const res = await fetch(`${backendUrl}/api/news/home`);
        if (!res.ok) return;
        const data = await res.json();
        
        const latestTime = data.updated_at;
        const savedTime = localStorage.getItem("lovanet.lastNewsUpdate");
        
        if (savedTime && latestTime && latestTime !== savedTime) {
          if (lastCheck.current === latestTime) return;

          lastCheck.current = latestTime;
          const firstItem = data.items?.[0];
          if (firstItem) {
            const options = {
              body: firstItem.title,
              icon: "/lovanet-icon-192.png",
              badge: "/lovanet-icon-64.png",
              tag: `lovanet-news-${latestTime}`,
            };

            const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : null;
            if (reg) {
              await reg.showNotification("Nouveau contenu sur Lovanet !", options);
            } else if (document.visibilityState !== "visible") {
              new Notification("Nouveau contenu sur Lovanet !", options);
            }
          }
        }
        
        if (latestTime) {
          lastCheck.current = latestTime;
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
