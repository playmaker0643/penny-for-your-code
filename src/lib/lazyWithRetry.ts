import { lazy, ComponentType } from "react";

/**
 * Lazy-load a component with automatic retry + recovery from stale chunk errors.
 * After a redeploy, hashed chunk filenames change; old tabs request a missing
 * chunk and crash with "Failed to fetch dynamically imported module". We detect
 * that, force a one-time reload to pick up the new index.html, and otherwise
 * retry a few times for transient network failures.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    const RELOAD_KEY = "lovable:chunk-reloaded";
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await factory();
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        const isChunkError =
          /Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
            msg
          );
        if (isChunkError && typeof window !== "undefined") {
          const alreadyReloaded = sessionStorage.getItem(RELOAD_KEY);
          if (!alreadyReloaded) {
            sessionStorage.setItem(RELOAD_KEY, "1");
            window.location.reload();
            // Return a never-resolving promise so Suspense stays mounted until reload
            return new Promise(() => {}) as never;
          }
        }
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
    throw lastError;
  });
}
