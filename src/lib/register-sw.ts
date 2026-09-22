// Single guarded registrar for the app service worker.
// Never registers in dev, Lovable preview hosts, or iframes — and actively
// unregisters any stale copy of this app's /sw.js in those contexts.
// Supports the ?sw=off kill switch.

async function unregisterAppServiceWorkers(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations
        .filter((reg) => {
          const url = reg.active?.scriptURL ?? reg.waiting?.scriptURL ?? reg.installing?.scriptURL ?? "";
          return url.endsWith("/sw.js");
        })
        .map((reg) => reg.unregister()),
    );
  } catch {
    // best effort
  }
}

function isPreviewOrDevContext(): boolean {
  if (!import.meta.env.PROD) return true;
  if (typeof window !== "undefined" && window.top !== window.self) return true;
  const host = window.location.hostname;
  return (
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev")
  );
}

export async function registerServiceWorker(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const killSwitch = new URL(window.location.href).searchParams.get("sw") === "off";
  if (killSwitch || isPreviewOrDevContext()) {
    await unregisterAppServiceWorkers();
    return;
  }
  const { registerSW } = await import("virtual:pwa-register");
  registerSW({ immediate: true });
}
