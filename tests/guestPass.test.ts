import { describe, expect, it } from "vitest";
import { GUEST_HOURS, guestExpired, guestHoursLeft, timeLeftText } from "@/lib/guestPass";

const NOW = Date.parse("2026-11-17T10:00:00Z");
const ago = (h: number) => new Date(NOW - h * 36e5).toISOString();

describe("guest pass", () => {
  it("lasts 48 hours from the first visit", () => {
    expect(guestHoursLeft(ago(0), NOW)).toBe(GUEST_HOURS);
    expect(guestHoursLeft(ago(40.5), NOW)).toBe(8);
    expect(guestHoursLeft(ago(60), NOW)).toBe(0);
    expect(guestExpired(ago(47.9), NOW)).toBe(false);
    expect(guestExpired(ago(48), NOW)).toBe(true);
    expect(guestExpired(undefined, NOW)).toBe(false);
    expect(guestExpired("not a date", NOW)).toBe(false);
    expect(guestHoursLeft(undefined, NOW)).toBe(GUEST_HOURS);
  });

  it("says the time left in days, then hours", () => {
    expect(timeLeftText(48)).toBe("2 days");
    expect(timeLeftText(30)).toBe("2 days");
    expect(timeLeftText(24)).toBe("24 hours");
    expect(timeLeftText(1)).toBe("1 hour");
  });
});
