import { useEffect, useState } from "react";
import { X } from "lucide-react";

const DISMISS_KEY = "hardcore777_install_dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOSSafari(): boolean {
  const ua = window.navigator.userAgent;
  const iOS = /iP(hone|ad|od)/.test(ua);
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return iOS && safari;
}

/**
 * One-time, dismissable install hint. Android/Chrome get a real install
 * button; iPhone Safari gets the Share → Add to Home Screen instructions.
 * Once dismissed or installed it never comes back.
 */
export function InstallCallout() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISS_KEY)) return;

    if (isIOSSafari()) {
      setIos(true);
      setVisible(true);
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      localStorage.setItem(DISMISS_KEY, "1");
    }
    setVisible(false);
    setDeferredPrompt(null);
  };

  return (
    <div className="fixed inset-x-0 bottom-20 z-40 mx-auto w-full max-w-md px-4 pb-safe">
      <div className="flex items-center justify-between gap-3 border border-primary bg-background px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold tracking-widest text-foreground">
            ADD 777 HARDCORE TO HOME SCREEN
          </p>
          {ios && (
            <p className="text-xs font-medium tracking-wide text-muted-foreground">
              Share → Add to Home Screen
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!ios && (
            <button
              type="button"
              onClick={install}
              className="bg-primary px-3 py-1.5 text-sm font-bold tracking-widest text-primary-foreground"
            >
              INSTALL
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss install hint"
            className="p-1 text-muted-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
