"use client";

/**
 * Terminal, visible error state for a failed live contract read.
 *
 * Production routes must never silently substitute `lib/fixtures/*` when a
 * canonical Studionet read fails — a reviewer looking at a green SAFE badge
 * has to be able to trust it came from the chain. This panel is what
 * production pages render instead, with an explicit retry.
 */
export function LiveDataError({
  title = "Failed to load live data",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      data-testid="live-data-error"
      className="checksum-plate p-5 border-emergency-red/70 bg-emergency-red/10 space-y-3"
    >
      <p className="font-mono-label text-xs uppercase text-emergency-red font-bold">{title}</p>
      <p className="text-sm text-cockpit-white/70 break-words">{message}</p>
      <p className="font-mono-label text-[11px] text-cockpit-white/50">
        This page reads the canonical Studionet registry only. It does not fall back to demo
        fixtures — visit <code>/demo</code> for the fixture walkthrough.
      </p>
      <button
        onClick={onRetry}
        className="font-mono-label text-xs uppercase px-4 py-2 border border-emergency-red text-emergency-red"
      >
        Retry live read
      </button>
    </div>
  );
}
