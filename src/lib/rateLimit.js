/**
 * Client-side rate limiter using localStorage.
 *
 * Because this is a frontend-only SPA, rate limiting is enforced in the
 * browser to prevent accidental double-submissions and add friction against
 * automated abuse. True server-side rate limiting is enforced by Supabase
 * Row-Level Security policies and can be further hardened with Supabase
 * Edge Functions if needed.
 *
 * Storage format:
 *   key:   `umarket_rl_<action>`
 *   value: JSON array of Unix timestamps (ms) — one entry per attempt
 *
 * Expired entries (older than the window) are pruned on every read.
 */

// ── Limits per action ─────────────────────────────────────────────────────────
// Tune these values as usage patterns become clear.
const LIMITS = {
  sign_in:        { max: 5,  windowMs: 15 * 60 * 1000 },       // 5 / 15 min
  sign_up:        { max: 3,  windowMs: 60 * 60 * 1000 },       // 3 / hour
  password_reset: { max: 3,  windowMs: 60 * 60 * 1000 },       // 3 / hour
  post_listing:   { max: 10, windowMs: 60 * 60 * 1000 },       // 10 / hour
  edit_listing:   { max: 20, windowMs: 60 * 60 * 1000 },       // 20 / hour
  contact_seller: { max: 15, windowMs: 60 * 60 * 1000 },       // 15 / hour
  report_listing: { max: 5,  windowMs: 60 * 60 * 1000 },       // 5 / hour
  boost_request:  { max: 5,  windowMs: 24 * 60 * 60 * 1000 },  // 5 / day
  profile_update: { max: 10, windowMs: 60 * 60 * 1000 },       // 10 / hour
}

const STORAGE_PREFIX = 'umarket_rl_'

/** Read recent timestamps for an action, pruning any that have expired. */
function getTimestamps(action, windowMs) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + action)
    const all = raw ? JSON.parse(raw) : []
    const cutoff = Date.now() - windowMs
    // Only keep entries inside the current window
    return Array.isArray(all) ? all.filter((t) => typeof t === 'number' && t > cutoff) : []
  } catch {
    return []
  }
}

/** Persist the current timestamps for an action. */
function saveTimestamps(action, timestamps) {
  try {
    localStorage.setItem(STORAGE_PREFIX + action, JSON.stringify(timestamps))
  } catch {
    // localStorage unavailable (private browsing, quota full) — fail open
    // so legitimate users aren't blocked by storage errors
  }
}

/**
 * Check whether an action is within its rate-limit window, and record it.
 *
 * Call this BEFORE executing the action. If `allowed` is false, show the
 * user `rateLimitMessage(action, retryAfterMs)` and abort the action.
 *
 * @param {string} action — one of the keys in LIMITS
 * @returns {{ allowed: boolean, retryAfterMs: number }}
 *   allowed       — true if the action should proceed
 *   retryAfterMs  — ms until the oldest window entry expires (0 if allowed)
 */
export function checkRateLimit(action) {
  const limit = LIMITS[action]
  // Unknown action — fail open (don't block)
  if (!limit) return { allowed: true, retryAfterMs: 0 }

  const { max, windowMs } = limit
  const timestamps = getTimestamps(action, windowMs)

  if (timestamps.length >= max) {
    // oldest entry is timestamps[0] — it expires at timestamps[0] + windowMs
    const retryAfterMs = Math.max(0, timestamps[0] + windowMs - Date.now())
    return { allowed: false, retryAfterMs }
  }

  // Record this attempt and persist
  timestamps.push(Date.now())
  saveTimestamps(action, timestamps)
  return { allowed: true, retryAfterMs: 0 }
}

/**
 * Format a millisecond duration as a human-readable string.
 * e.g. "2 minutes", "47 seconds", "1 hour"
 */
export function formatRetryAfter(ms) {
  const secs = Math.ceil(ms / 1000)
  if (secs < 60) return `${secs} second${secs !== 1 ? 's' : ''}`
  const mins = Math.ceil(secs / 60)
  if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''}`
  const hours = Math.ceil(mins / 60)
  return `${hours} hour${hours !== 1 ? 's' : ''}`
}

/**
 * Build a user-facing 429-style message.
 * @param {string} action
 * @param {number} retryAfterMs
 */
export function rateLimitMessage(_action, retryAfterMs) {
  return `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} and try again.`
}
