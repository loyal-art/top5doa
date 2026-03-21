"use client";

import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type PromptType = "ios" | "android" | null;

function getPromptType(): PromptType {
  if (typeof window === "undefined") return null;

  // Only show on mobile
  const isMobileWidth = window.matchMedia("(max-width: 768px)").matches;
  if (!isMobileWidth) return null;

  // Don't show if already running as installed PWA
  if (window.matchMedia("(display-mode: standalone)").matches) return null;

  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";

  return null;
}

export function InstallPrompt() {
  const [promptType, setPromptType] = useState<PromptType>(null);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const type = getPromptType();
    setPromptType(type);

    if (type === "ios") {
      // Only show once per session
      if (sessionStorage.getItem("ios-install-dismissed")) {
        setDismissed(true);
      }
    }

    if (type === "android") {
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
      };
      window.addEventListener("beforeinstallprompt", handler);
      return () => window.removeEventListener("beforeinstallprompt", handler);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    if (promptType === "ios") {
      sessionStorage.setItem("ios-install-dismissed", "1");
    }
  };

  // iOS banner
  if (promptType === "ios" && !dismissed) {
    return (
      <div className="fixed bottom-12 left-0 right-0 z-[60] flex items-center justify-between gap-3 bg-brand-bg/95 border-t border-brand-accent/30 px-4 py-2.5 font-mono text-sm backdrop-blur-sm">
        <span className="text-brand-text/90 tracking-wide">
          Install TOP5DOA: Tap{" "}
          <span className="inline-block text-brand-accent" aria-label="share icon">
            &#9243;
          </span>{" "}
          then &ldquo;Add to Home Screen&rdquo;
        </span>
        <button
          onClick={handleDismiss}
          className="shrink-0 text-brand-text/50 hover:text-brand-text text-lg leading-none ml-2"
          aria-label="Dismiss"
        >
          &#10005;
        </button>
      </div>
    );
  }

  // Android banner (beforeinstallprompt)
  if (promptType === "android" && deferredPrompt && !dismissed) {
    const handleInstall = async () => {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setDeferredPrompt(null);
    };

    return (
      <div className="fixed bottom-12 left-0 right-0 z-[60] flex items-center justify-between gap-3 bg-brand-bg/95 border-t border-brand-accent/30 px-4 py-2.5 font-mono text-sm backdrop-blur-sm">
        <span className="text-brand-text/90 font-bold tracking-wide">
          Add TOP5DOA to your home screen
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleInstall}
            className="rounded bg-brand-accent px-3 py-1 text-xs font-bold text-brand-bg hover:opacity-90 transition-opacity"
          >
            INSTALL
          </button>
          <button
            onClick={handleDismiss}
            className="text-brand-text/50 hover:text-brand-text text-lg leading-none"
            aria-label="Dismiss"
          >
            &#10005;
          </button>
        </div>
      </div>
    );
  }

  return null;
}
