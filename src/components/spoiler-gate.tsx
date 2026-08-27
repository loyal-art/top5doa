import type { ReactNode } from "react";

interface SpoilerGateProps {
  /** When true, blur the children and overlay the call to action. */
  locked: boolean;
  /** Headline shown over the blurred content. */
  message: string;
  ctaLabel: string;
  ctaHref: string;
  children: ReactNode;
}

/**
 * Blurs its children behind a call to action.
 *
 * Extracted from the results step of the topic voting flow, where positions 2-5
 * were gated inline for logged-out users. The public list page needs the same
 * treatment, so it lives here rather than being written twice.
 *
 * The wrapper markup is identical in both states — only the blur class and the
 * overlay are conditional — so unlocking does not change the surrounding layout.
 *
 * This is presentation only. The gated content is still sent to the client, so
 * do not use it to hide anything that must actually be withheld.
 */
export function SpoilerGate({
  locked,
  message,
  ctaLabel,
  ctaHref,
  children,
}: SpoilerGateProps) {
  return (
    <div className="relative">
      <div className={locked ? "blur-sm pointer-events-none select-none" : ""}>
        {children}
      </div>
      {locked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-brand-bg/70">
          <p className="font-display text-lg tracking-wide text-white text-center px-4">
            {message}
          </p>
          <a
            href={ctaHref}
            className="px-6 py-2.5 rounded-xl bg-brand-accent text-brand-bg font-mono font-bold text-sm hover:bg-brand-accent/90 transition-colors"
          >
            {ctaLabel}
          </a>
        </div>
      )}
    </div>
  );
}
