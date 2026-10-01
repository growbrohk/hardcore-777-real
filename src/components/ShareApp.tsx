import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

const SHARE_URL = "https://hardcore-777.vercel.app/";
const INVITE =
  "Join 777 HARDCORE — 100 push-ups, 100 sit-ups, 100 squats, every day.";

export function ShareAppButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Share"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground active:text-foreground"
      >
        <Share className="h-5 w-5" strokeWidth={2.5} />
      </button>
      {open && <ShareAppDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function ShareAppDialog({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const url = SHARE_URL;

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${INVITE}\n${url}`)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md border-2 border-primary bg-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-xl font-bold leading-none tracking-[0.2em]">SHARE</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 shrink-0 items-center justify-center border border-border active:bg-muted"
          >
            <X className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>

        <div className="mt-6 flex justify-center bg-white p-4">
          <QRCodeSVG value={url} size={180} bgColor="#ffffff" fgColor="#000000" level="M" />
        </div>
        <p className="mt-3 truncate text-center text-xs font-semibold tracking-wide text-muted-foreground">
          {url}
        </p>

        <button
          type="button"
          onClick={() => void copy()}
          className="mt-6 flex h-12 w-full items-center justify-center border border-border text-sm font-bold tracking-[0.25em] active:bg-muted"
        >
          {copied ? "COPIED" : "COPY LINK"}
        </button>
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex h-12 w-full items-center justify-center bg-primary text-sm font-bold tracking-[0.25em] text-primary-foreground"
        >
          SHARE ON WHATSAPP
        </a>
      </div>
    </div>
  );
}
