// Client-side brute-force protection for the vault unlock screen.
//
// Threat model
// ------------
// The DEK-wrapping KEK is derived via PBKDF2-SHA256 with 600k iterations,
// which already makes offline guessing expensive. This module is a
// second, cheaper defence for the *online* case: someone with physical
// access to an unlocked device who wants to spray common passwords at
// the lock screen. We slow that path down without adding a server round
// trip (so it works offline too).
//
// Strategy
// --------
// Track consecutive failures per userId in localStorage. After 3, 5, and
// 10 failures we impose escalating cooldowns during which the Unlock
// button is disabled and a countdown is shown. A successful unlock
// clears the counter. The counter is not authoritative — anyone who
// wipes localStorage can bypass it — but it costs an attacker
// unrestricted keystroke access to the device, which is the same
// posture as OS-level PIN lockouts.

const STORAGE_PREFIX = "aegis.unlock.throttle.";

interface ThrottleState {
  fails: number;
  lockedUntil: number; // epoch ms; 0 = not locked
}

interface Rule {
  minFails: number;
  cooldownMs: number;
}

// Ordered from lightest to heaviest.
const RULES: Rule[] = [
  { minFails: 3, cooldownMs: 5_000 },
  { minFails: 5, cooldownMs: 30_000 },
  { minFails: 8, cooldownMs: 2 * 60_000 },
  { minFails: 12, cooldownMs: 10 * 60_000 },
];

function key(userId: string) {
  return STORAGE_PREFIX + userId;
}

function read(userId: string): ThrottleState {
  if (typeof window === "undefined") return { fails: 0, lockedUntil: 0 };
  try {
    const raw = window.localStorage.getItem(key(userId));
    if (!raw) return { fails: 0, lockedUntil: 0 };
    const parsed = JSON.parse(raw) as Partial<ThrottleState>;
    return {
      fails: Number.isFinite(parsed.fails) ? Number(parsed.fails) : 0,
      lockedUntil: Number.isFinite(parsed.lockedUntil) ? Number(parsed.lockedUntil) : 0,
    };
  } catch {
    return { fails: 0, lockedUntil: 0 };
  }
}

function write(userId: string, state: ThrottleState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(userId), JSON.stringify(state));
  } catch {
    // Quota / private mode — silently no-op. The throttle just doesn't
    // persist across reloads for this user, which is acceptable.
  }
}

/**
 * How many ms remain in the current cooldown, or 0 if not throttled.
 * Callers can poll this on a 1s interval to render a countdown.
 */
export function remainingCooldownMs(userId: string, now: number = Date.now()): number {
  const state = read(userId);
  if (!state.lockedUntil || state.lockedUntil <= now) return 0;
  return state.lockedUntil - now;
}

export function getFailureCount(userId: string): number {
  return read(userId).fails;
}

/**
 * Record a failed unlock attempt and return the new cooldown (ms) to
 * apply. Zero means "no cooldown yet, let the user retry immediately".
 */
export function recordFailure(userId: string, now: number = Date.now()): number {
  const state = read(userId);
  const fails = state.fails + 1;
  // Pick the strictest rule that applies.
  let cooldown = 0;
  for (const rule of RULES) {
    if (fails >= rule.minFails) cooldown = rule.cooldownMs;
  }
  const next: ThrottleState = {
    fails,
    lockedUntil: cooldown > 0 ? now + cooldown : 0,
  };
  write(userId, next);
  return cooldown;
}

/** Clear the counter after a successful unlock. */
export function recordSuccess(userId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key(userId));
  } catch {
    // ignore
  }
}
