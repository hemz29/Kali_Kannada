"use client";
import Link from "next/link";
import { useState } from "react";
import { GUEST_HOURS, PRIVACY_PROMISE } from "@/lib/guestPass";

export const SAVE_DISMISSED_COOKIE = "kk_save_dismissed";

// Shown to guests (started with "Start free") until they add an email or Google. It can be closed; once closed it
// only comes back at a natural exit (the parent page).
export function SaveProgressStrip({ name, dismissible = true }: { name?: string; dismissible?: boolean }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <div className="no-print flex items-center gap-3 rounded-2xl bg-black px-4 py-3 text-sm text-white">
      <Link href="/save" className="flex flex-1 items-center gap-3">
        <span className="flex-1">
          <b className="font-semibold text-[var(--brand-yellow)]">Save {name ? `${name}'s` : "your"} progress</b>
          <span className="block text-gray-300">Guest access lasts {GUEST_HOURS} hours. Register free to keep practising, see detailed progress and come back on any device. {PRIVACY_PROMISE}</span>
        </span>
        <span aria-hidden>→</span>
      </Link>
      {dismissible && (
        <button
          aria-label="Not now"
          title="Not now"
          onClick={() => {
            document.cookie = `${SAVE_DISMISSED_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
            setHidden(true);
          }}
          className="grid h-8 w-8 place-items-center rounded-full text-gray-300 hover:bg-white/10 hover:text-white"
        >
          ×
        </button>
      )}
    </div>
  );
}
