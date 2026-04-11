/**
 * Input validation and sanitization library.
 *
 * Uses schema-based validation to enforce type checks, length limits, and
 * allowed values on all user-submitted data. Follows OWASP Input Validation
 * Cheat Sheet recommendations:
 *   https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
 *
 * Sanitization applied to all user strings:
 *   1. Null bytes removed — prevents null-byte injection into text fields
 *   2. Leading/trailing whitespace trimmed
 *   3. Internal runs of whitespace collapsed to a single space
 *
 * XSS note:  React JSX auto-escapes all rendered values — no dangerouslySetInnerHTML
 *            is used, so stored strings are safe to display.
 * SQLi note: Supabase JS SDK uses parameterized queries — SQL injection is not
 *            possible through the client library.
 *
 * These validations add defense-in-depth and enforce business-rule constraints.
 */

import {
  CATEGORIES,
  CONDITIONS,
  GRADES,
  REPORT_REASONS,
} from '../constants/categories'

// ── Allowed values ────────────────────────────────────────────────────────────

/** Category IDs that may appear on a listing (excludes the UI-only "all"). */
export const VALID_CATEGORY_IDS = CATEGORIES
  .map((c) => c.id)
  .filter((id) => id !== 'all')

export const VALID_CONDITIONS    = CONDITIONS
export const VALID_GRADES        = GRADES
export const VALID_CONTACT_TYPES = ['phone', 'email', 'instagram', 'snapchat', 'text']
export const VALID_BOOST_DAYS    = [1, 3, 7, 14, 30]

// RFC-5321 practical email pattern: local@domain (no length checks on parts,
// but the total is capped at 254 chars by the schema max below).
const EMAIL_RE = /^[^\s@]+@[^\s@]{1,253}$/

// ── Image upload constraints ───────────────────────────────────────────────────

export const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
])

/** 10 MB per image — consistent with Supabase Storage default upload limit. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024

/**
 * Validate a File object before upload.
 * @param {File} file
 * @returns {string|null} error message, or null if valid
 */
export function validateImageFile(file) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type.toLowerCase())) {
    const isHeic = file.type.toLowerCase().includes('heic') || file.type.toLowerCase().includes('heif') || file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')
    if (isHeic) {
      return `iPhone HEIC photos aren't supported by browsers. On your iPhone go to Settings → Camera → Formats → select "Most Compatible" to shoot in JPG, then re-take the photo.`
    }
    return `"${file.name}" is not a supported image type. Please use JPG, PNG, WebP, or GIF.`
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `"${file.name}" exceeds the 10 MB limit per image.`
  }
  return null
}

// ── Sanitization ──────────────────────────────────────────────────────────────

/**
 * Sanitize a user-supplied string value.
 *   - Coerces to string
 *   - Removes null bytes (U+0000) — prevents null-byte injection
 *   - Trims surrounding whitespace
 *   - Collapses internal whitespace runs to a single space
 *
 * @param {unknown} value
 * @returns {string}
 */
export function sanitizeText(value) {
  if (value == null) return ''
  return String(value)
    .replace(/\0/g, '')   // strip null bytes
    .trim()
    .replace(/\s+/g, ' ') // normalize internal whitespace
}

/**
 * Sanitize an email address: sanitizeText + lowercase.
 * @param {unknown} value
 * @returns {string}
 */
export function sanitizeEmail(value) {
  return sanitizeText(value).toLowerCase()
}

// ── Core validator ────────────────────────────────────────────────────────────

/**
 * Validate a single field value against one rule definition.
 *
 * Rule shape:
 *   type        — 'string' | 'email' | 'number' | 'integer' | 'enum'
 *   required    — boolean (default false)
 *   requiredMsg — custom message when required check fails
 *   label       — display name used in error messages
 *   min / max   — bounds for string lengths or numeric ranges
 *   values      — allowed values array (for 'enum')
 *
 * @returns {string|null} error message, or null if valid
 */
function validateField(value, rule, fieldName) {
  const label = rule.label ?? fieldName

  // ── Required check ────────────────────────────────────────────────────────
  const isEmpty =
    value == null ||
    value === '' ||
    (typeof value === 'string' && !value.trim())

  if (rule.required && isEmpty) {
    return rule.requiredMsg ?? `${label} is required.`
  }

  // Skip type/length checks when the field is empty and not required
  if (isEmpty) return null

  // ── Type checks ───────────────────────────────────────────────────────────
  switch (rule.type) {
    case 'string': {
      const str = typeof value === 'string' ? value.trim() : String(value).trim()
      if (rule.min != null && str.length < rule.min)
        return `${label} must be at least ${rule.min} characters.`
      if (rule.max != null && str.length > rule.max)
        return `${label} must be ${rule.max} characters or fewer.`
      break
    }

    case 'email': {
      const str = sanitizeEmail(value)
      if (!EMAIL_RE.test(str))
        return `${label} must be a valid email address.`
      if (str.length > 254)
        return `${label} is too long.`
      break
    }

    case 'number': {
      const n = Number(value)
      if (isNaN(n))           return `${label} must be a number.`
      if (rule.min != null && n < rule.min) return `${label} must be at least ${rule.min}.`
      if (rule.max != null && n > rule.max) return `${label} must be at most ${rule.max}.`
      break
    }

    case 'integer': {
      const n = Number(value)
      if (!Number.isInteger(n) || isNaN(n)) return `${label} must be a whole number.`
      if (rule.min != null && n < rule.min) return `${label} must be at least ${rule.min}.`
      if (rule.max != null && n > rule.max) return `${label} must be at most ${rule.max}.`
      break
    }

    case 'enum': {
      if (!rule.values.includes(value))
        return `${label} has an unrecognised value.`
      break
    }

    default:
      break
  }

  return null
}

/**
 * Validate a data object against a schema map.
 *
 * Only fields declared in the schema are validated; extra keys in `data`
 * are silently ignored (reject-unexpected-fields is handled at the
 * Supabase insert level via column constraints).
 *
 * @param {Record<string, unknown>}  data   — field values to validate
 * @param {Record<string, object>}   schema — validation rules keyed by field name
 * @returns {{ valid: boolean, errors: Record<string, string>, firstError: string|null }}
 */
export function validate(data, schema) {
  const errors = {}
  for (const [field, rule] of Object.entries(schema)) {
    const msg = validateField(data[field], rule, field)
    if (msg) errors[field] = msg
  }
  const keys = Object.keys(errors)
  return {
    valid: keys.length === 0,
    errors,
    firstError: keys.length > 0 ? errors[keys[0]] : null,
  }
}

// ── Schemas ───────────────────────────────────────────────────────────────────

/**
 * Schema for new listing creation (PostListingModal).
 * Numeric fields are validated only when non-empty; the component passes
 * null/'' for fields that don't apply to the selected category.
 */
export const listingSchema = {
  title:         { type: 'string',  label: 'Title',        required: true, min: 3,  max: 100 },
  category:      { type: 'enum',    label: 'Category',     required: true, values: VALID_CATEGORY_IDS },
  description:   { type: 'string',  label: 'Description',                  max: 2000 },
  location:      { type: 'string',  label: 'Location',                     max: 200 },
  price:         { type: 'number',  label: 'Price',                        min: 0,  max: 999_999 },
  budget:        { type: 'number',  label: 'Budget',                       min: 0,  max: 999_999 },
  beds:          { type: 'integer', label: 'Beds',                         min: 0,  max: 50 },
  avail:         { type: 'string',  label: 'Availability',                 max: 50 },
  contact_value: {
    type: 'string',
    label: 'Contact info',
    required: true,
    min: 2,
    max: 100,
    requiredMsg: 'Please add contact info so buyers can reach you.',
  },
  contact_type:  { type: 'enum',    label: 'Contact type', required: true, values: VALID_CONTACT_TYPES },
  condition:     { type: 'enum',    label: 'Condition',                    values: VALID_CONDITIONS },
}

/** Schema for editing an existing listing (EditListingModal). */
export const editListingSchema = {
  title:       { type: 'string',  label: 'Title',        required: true, min: 3,  max: 100 },
  description: { type: 'string',  label: 'Description',                  max: 2000 },
  location:    { type: 'string',  label: 'Location',                     max: 200 },
  price:       { type: 'number',  label: 'Price',                        min: 0,  max: 999_999 },
  budget:      { type: 'number',  label: 'Budget',                       min: 0,  max: 999_999 },
  beds:        { type: 'integer', label: 'Beds',                         min: 0,  max: 50 },
  avail:       { type: 'string',  label: 'Availability',                 max: 50 },
}

/**
 * Schema for new account sign-up.
 * Password minimum is 8 characters (OWASP recommendation).
 * Note: update Supabase Auth password policy in the dashboard to match
 * (Auth → Settings → Password minimum length = 8).
 */
export const signUpSchema = {
  name:     { type: 'string', label: 'Name',     required: true, min: 2, max: 60 },
  email:    { type: 'email',  label: 'Email',    required: true },
  password: {
    type: 'string',
    label: 'Password',
    required: true,
    min: 8,
    max: 128,
    requiredMsg: 'Password is required.',
  },
}

/** Schema for sign-in (only format checks — don't reveal password policy). */
export const signInSchema = {
  email:    { type: 'email',  label: 'Email',    required: true },
  password: { type: 'string', label: 'Password', required: true, min: 1, max: 128 },
}

/** Schema for profile edits (UserProfile). */
export const profileSchema = {
  name:         { type: 'string', label: 'Name',    required: true, min: 2,  max: 60 },
  grade:        { type: 'enum',   label: 'Year',                    values: VALID_GRADES },
  contact:      { type: 'string', label: 'Contact',                 max: 100 },
  contact_type: { type: 'enum',   label: 'Contact type',            values: VALID_CONTACT_TYPES },
}

/** Schema for reporting a listing (ReportModal). */
export const reportSchema = {
  reason: { type: 'enum',   label: 'Reason', required: true, values: REPORT_REASONS },
  note:   { type: 'string', label: 'Note',                   max: 500 },
}

/** Schema for requesting a listing boost (BoostModal). */
export const boostSchema = {
  email:        { type: 'email',  label: 'Email',    required: true },
  selectedDays: { type: 'enum',   label: 'Duration', required: true, values: VALID_BOOST_DAYS },
  note:         { type: 'string', label: 'Note',                     max: 300 },
}
