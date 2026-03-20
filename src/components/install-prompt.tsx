"use client";

import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!deferredPrompt || dismissed) return null;

  const handleInstall = async () => {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setDeferredPrompt(null);
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-between gap-3 bg-brand-accent/95 px-4 py-2 text-brand-bg font-mono text-sm backdrop-blur-sm">
      <span className="font-bold tracking-wide">
        Add TOP5DOA to your home screen
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={handleInstall}
          className="rounded bg-brand-bg px-3 py-1 text-xs font-bold text-brand-accent hover:opacity-90 transition-opacity"
        >
          INSTALL
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-brand-bg/70 hover:text-brand-bg text-lg leading-none"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
