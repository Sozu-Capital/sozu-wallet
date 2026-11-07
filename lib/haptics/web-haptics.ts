/**
 * Web haptics for the faucet ritual — Vibration API where supported,
 * iOS switch-trick fallback everywhere else. Call tap/success from onClick
 * (user gesture); claimingPulse may run on an interval during transfer.
 *
 * Each function returns true only when navigator.vibrate accepted the pattern.
 */

import { iosHapticSingle } from "@/lib/haptics/ios-switch-pulse";

function vibrate(pattern: number | number[]): boolean {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      return navigator.vibrate(pattern);
    }
  } catch {
    /* ignore */
  }
  return false;
}

/** Claim button press — medium impact. */
export function hapticClaimPress(): boolean {
  if (vibrate(40)) return true;
  iosHapticSingle();
  return false;
}

/** Soft pulse while the transfer is in flight (~every 500ms). */
export function hapticClaimingPulse(): boolean {
  if (vibrate(12)) return true;
  iosHapticSingle();
  return false;
}

/**
 * NameDrop-shaped shake. on, off, on, off… in milliseconds.
 * Motors do not spin up under ~40ms, so the old 12ms claim tick was silent
 * and only the short settle pattern at the end could be felt.
 * This swells into long full-power buzzes. One navigator.vibrate call plays it.
 */
export const AIRDROP_CONTACT_PATTERN: number[] = [
  70, 40, 110, 35, 170, 30, 260, 40, 420, 50, 700, 90, 180, 30, 360, 40, 800, 70,
  500,
];

export function airdropContactDurationMs(
  pattern: readonly number[] = AIRDROP_CONTACT_PATTERN,
): number {
  return pattern.reduce((sum, ms) => sum + ms, 0);
}

/** Scandalous contact-share shake. True when this browser accepted the pattern. */
export function hapticAirdropContact(): boolean {
  return vibrate(AIRDROP_CONTACT_PATTERN);
}

/** Success: dum … dum dum */
export function hapticClaimSuccess(): boolean {
  if (vibrate([60, 220, 30, 90, 30])) return true;
  iosHapticSingle();
  setTimeout(() => iosHapticSingle(), 280);
  setTimeout(() => iosHapticSingle(), 400);
  return false;
}

/** Error / retry — short double tap. */
export function hapticClaimError(): boolean {
  if (vibrate([30, 60, 30])) return true;
  iosHapticSingle();
  return false;
}
