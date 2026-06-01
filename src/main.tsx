import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Register the app-shell service worker so the site is installable as a PWA.
// Skip in the Lovable editor preview iframe to avoid caching stale builds.
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();
const isPreviewHost =
  typeof window !== "undefined" &&
  (window.location.hostname.includes("id-preview--") ||
    window.location.hostname.includes("lovableproject.com"));

if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  if (isInIframe || isPreviewHost) {
    // Clean up any previously-registered SWs in preview contexts.
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => {
        if (!r.active || !r.active.scriptURL.includes("firebase-messaging-sw")) {
          r.unregister().catch(() => {});
        }
      });
    }).catch(() => {});
  } else {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }
}
