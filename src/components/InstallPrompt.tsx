"use client";

import { useEffect, useState } from "react";

// The non-standard event Chrome/Edge fire when a PWA is installable.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "qt-install-dismissed";

interface Visibility {
  show: boolean; // banner eligible to show at all
  ios: boolean; // iOS Safari → show manual instructions
}

export function InstallPrompt() {
  // null until mounted, so server and first client render both emit nothing
  // (no hydration mismatch). Populated once from browser-only APIs.
  const [vis, setVis] = useState<Visibility | null>(null);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    const dismissed = sessionStorage.getItem(DISMISS_KEY) === "1";
    const ua = navigator.userAgent;
    const ios =
      /iphone|ipad|ipod/i.test(ua) &&
      /safari/i.test(ua) &&
      !/crios|fxios/i.test(ua);

    const eligible = !standalone && !dismissed;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from browser APIs
    setVis({ show: eligible, ios: ios && eligible });

    const onPrompt = (e: Event) => {
      e.preventDefault(); // suppress Chrome's own mini-infobar
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!vis || !vis.show) return null;
  // Chrome path needs the captured event; iOS path shows manual steps.
  if (!deferred && !vis.ios) return null;

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setVis((v) => (v ? { ...v, show: false } : v));
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 shadow-lg">
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny static icon, optimization unnecessary */}
      <img src="/icons/icon-192.png" alt="" className="h-9 w-9 rounded-lg" />
      <div className="flex-1 text-xs leading-snug">
        {vis.ios ? (
          <>
            <span className="font-semibold text-[var(--foreground)]">
              Install Quest Tracker
            </span>
            <br />
            <span className="text-[var(--muted)]">
              Tap the Share icon, then “Add to Home Screen”.
            </span>
          </>
        ) : (
          <span className="font-semibold text-[var(--foreground)]">
            Install Quest Tracker on your device
          </span>
        )}
      </div>
      {!vis.ios && (
        <button
          onClick={install}
          className="rounded-lg bg-[var(--purple)] px-3 py-2 text-xs font-semibold text-[#0c0c14]"
        >
          Install
        </button>
      )}
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="px-1 text-lg leading-none text-[var(--muted)]"
      >
        ×
      </button>
    </div>
  );
}
