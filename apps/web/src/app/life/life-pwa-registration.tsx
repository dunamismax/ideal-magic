"use client";

import { useEffect } from "react";

export function LifePwaRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // PWA support is progressive; the counter still runs from Dexie.
    });
  }, []);

  return null;
}
