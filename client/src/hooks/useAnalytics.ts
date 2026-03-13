import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

function getFingerprint(): string {
  const key = "ffx_fp";
  let fp = localStorage.getItem(key);
  if (!fp) {
    fp = crypto.randomUUID().replace(/-/g, "");
    localStorage.setItem(key, fp);
  }
  return fp;
}

export function useAnalytics() {
  const [location] = useLocation();
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fpRef = useRef<string>(getFingerprint());

  useEffect(() => {
    const fp = fpRef.current;
    const page = location || "/";
    fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fingerprint: fp, page }),
    }).catch(() => {});
  }, [location]);

  useEffect(() => {
    const fp = fpRef.current;
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(() => {
      const page = window.location.pathname + window.location.hash;
      fetch("/api/analytics/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fingerprint: fp, page }),
      }).catch(() => {});
    }, 30_000);
    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, []);
}
