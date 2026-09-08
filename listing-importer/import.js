// ─────────────────────────────────────────────────────────────────────────────
// UMarket Listing Importer
//
// Reads scraped listings from a JSON file and posts them to Supabase.
// Works with any scraping source — just output the standard format below.
//
// Setup:
//   1. Copy .env.example → .env and fill in your keys
//   2. Create a bot user in Supabase Auth (Authentication → Users → Invite)
//      Copy the UUID as BOT_USER_ID in .env
//   3. npm install
//
// Usage:
//   node import.js listings.json           → import file
//   node import.js listings.json --dry-run → preview only, no DB writes
//   node import.js listings.json --school=calpoly  → override school
//
// Input JSON format (array of objects):
//   See sample-input.json for a full example.
// ─────────────────────────────────────────────────────────────────────────────

require("dotenv").config();
const fs    = require("fs");
const path  = require("path");
const fetch = require("node-fetch");
const { createClient } = require("@supabase/supabase-js");

// ── Config ────────────────────────────────────────────────────────────────────

const DRY_RUN   = process.argv.includes("--dry-run");
const INPUT_FILE = process.argv.find((a) => a.endsWith(".json") && !a.includes("package"));
const SCHOOL_ARG = (process.argv.find((a) => a.startsWith("--school=")) ?? "").replace("--school=", "");

const SUPABASE_URL           = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY   = process.env.SUPABASE_SERVICE_KEY;   // service_role key, never anon
const BOT_USER_ID            = process.env.BOT_USER_ID;            // UUID of the bot Supabase user
const DEFAULT_SCHOOL_ID      = SCHOOL_ARG || process.env.DEFAULT_SCHOOL_ID || "utah";
const DELAY_MS               = 600;   // ms between inserts to avoid hammering Supabase
const IMPORTED_LOG           = path.join(__dirname, "imported.json");

// ── Validation ────────────────────────────────────────────────────────────────

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌  SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env");
  process.exit(1);
}
if (!BOT_USER_ID) {
  console.error("❌  BOT_USER_ID must be set in .env (UUID of the bot Supabase user)");
  process.exit(1);
}
if (!INPUT_FILE) {
  console.error("❌  Pass a .json file as argument: node import.js listings.json");
  process.exit(1);
}
if (!fs.existsSync(INPUT_FILE)) {
  console.error(`❌  File not found: ${INPUT_FILE}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Deduplication log ─────────────────────────────────────────────────────────
// Tracks external_id values already imported so we never double-post.

function loadImported() {
  if (!fs.existsSync(IMPORTED_LOG)) return new Set();
  return new Set(JSON.parse(fs.readFileSync(IMPORTED_LOG, "utf-8")));
}
function saveImported(set) {
  fs.writeFileSync(IMPORTED_LOG, JSON.stringify([...set], null, 2));
}

// ── Geocoding ─────────────────────────────────────────────────────────────────

async function censusGeocode(fullAddress) {
  try {
    const params = new URLSearchParams({
      address: fullAddress,
      benchmark: "Public_AR_Current",
      format: "json",
    });
    const res = await fetch(
      `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?${params}`
    );
    if (res.ok) {
      const data = await res.json();
      const match = data?.result?.addressMatches?.[0];
      if (match) return { lat: match.coordinates.y, lng: match.coordinates.x };
    }
  } catch {}
  return null;
}

async function nominatimGeocode(query) {
  try {
    const params = new URLSearchParams({
      format: "json",
      limit: "1",
      countrycodes: "us",
      q: query,
    });
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      { headers: { "Accept-Language": "en", "User-Agent": "UMarket-Importer/1.0" } }
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
    }
  } catch {}
  return null;
}

const SCHOOL_HINTS = {
  utah:    "Salt Lake City, UT",
  calpoly: "San Luis Obispo, CA",
  ucsb:    "Santa Barbara, CA",
  tcu:     "Fort Worth, TX",
  ucla:    "Los Angeles, CA",
  ucsd:    "La Jolla, CA",
};

async function geocode(address, schoolId) {
  if (!address?.trim()) return null;
  const addr = address.trim();
  const hint = SCHOOL_HINTS[schoolId] ?? "";
  const full = hint ? `${addr}, ${hint}` : addr;

  return (
    (await censusGeocode(full)) ||
    (hint ? await censusGeocode(`${addr}, USA`) : null) ||
    (await nominatimGeocode(full)) ||
    (hint ? await nominatimGeocode(addr) : null) ||
    null
  );
}

// ── Category mapping ──────────────────────────────────────────────────────────
// Maps common scraper category strings to UMarket category IDs.

const CATEGORY_MAP = {
  // Housing
  housing:    "housing",
  rental:     "housing",
  apartment:  "housing",
  house:      "housing",
  condo:      "housing",
  room:       "housing",
  sublease:   "sublease",
  sublet:     "sublease",
  roommate:   "looking_roommate",
  // Marketplace
  textbooks:  "textbooks",
  textbook:   "textbooks",
  books:      "textbooks",
  furniture:  "furniture",
  electronics:"electronics",
  clothing:   "clothing",
  clothes:    "clothing",
  appliances: "appliances",
  sports:     "sports",
  tickets:    "events",
  event:      "events",
  misc:       "misc",
  other:      "misc",
};

function normalizeCategory(raw) {
  if (!raw) return "misc";
  const key = String(raw).toLowerCase().trim();
  return CATEGORY_MAP[key] ?? "misc";
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const raw = JSON.parse(fs.readFileSync(INPUT_FILE, "utf-8"));
  const listings = Array.isArray(raw) ? raw : [raw];

  const imported = loadImported();
  let newCount = 0;
  let skipCount = 0;
  let failCount = 0;

  console.log(`\n📦  UMarket Listing Importer${DRY_RUN ? " (DRY RUN)" : ""}`);
  console.log(`    Input:  ${INPUT_FILE} (${listings.length} listings)`);
  console.log(`    School: ${DEFAULT_SCHOOL_ID}`);
  console.log(`    Bot ID: ${BOT_USER_ID}\n`);

  for (const item of listings) {
    const externalId = String(item.external_id ?? item.id ?? item.url ?? "").trim();

    // Skip already-imported listings
    if (externalId && imported.has(externalId)) {
      skipCount++;
      console.log(`  ⏭  [skip] ${item.title ?? externalId} (already imported)`);
      continue;
    }

    const category  = normalizeCategory(item.category);
    const isHousing = ["housing", "sublease", "looking_housing", "looking_roommate"].includes(category);
    const isLooking = ["looking_for", "looking_housing", "looking_roommate"].includes(category);
    const schoolId  = item.school_id ?? DEFAULT_SCHOOL_ID;

    // Geocode housing listings
    let lat = item.lat ?? null;
    let lng = item.lng ?? null;
    if (isHousing && item.location && (!lat || !lng)) {
      process.stdout.write(`  🌍  Geocoding: ${item.location} ... `);
      const coords = await geocode(item.location, schoolId);
      if (coords) {
        lat = coords.lat;
        lng = coords.lng;
        process.stdout.write(`✓ (${lat.toFixed(4)}, ${lng.toFixed(4)})\n`);
      } else {
        process.stdout.write(`✗ not found\n`);
      }
    }

    const row = {
      title:           String(item.title ?? "").trim().slice(0, 200),
      category,
      description:     String(item.description ?? "").trim(),
      location:        String(item.location ?? "").trim(),
      images:          Array.isArray(item.images) ? item.images : (item.image_url ? [item.image_url] : []),
      seller_id:       item.seller_id ?? BOT_USER_ID,
      school_id:       schoolId,
      sold:            false,
      is_housing:      isHousing,
      is_looking:      isLooking,
      price:           isLooking ? null : (Number(item.price) || 0),
      condition:       (!isLooking && !isHousing) ? (item.condition ?? null) : null,
      budget:          isLooking ? (Number(item.budget) || null) : null,
      beds:            isHousing ? (Number(item.beds) || null) : null,
      size:            isHousing ? (item.baths ?? item.size ?? null) : null,
      avail:           isHousing ? (item.available ?? item.avail ?? null) : null,
      spots_available: category === "sublease" ? (Number(item.spots_available) || null) : null,
      contact_type:    item.contact_type ?? "email",
      contact_value:   String(item.contact_value ?? item.email ?? item.phone ?? "").trim(),
      lat,
      lng,
      // external_url only works if you add the column:
      // ALTER TABLE listings ADD COLUMN external_url text;
      // ...(item.url ? { external_url: item.url } : {}),
    };

    if (!row.title) {
      console.log(`  ⚠   Skipping item with no title (external_id: ${externalId})`);
      failCount++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  ✅  [dry-run] Would insert: "${row.title}" (${row.category}) — $${row.price ?? "??"}`);
      if (externalId) imported.add(externalId);
      newCount++;
      continue;
    }

    const { error } = await supabase.from("listings").insert(row);
    if (error) {
      console.error(`  ❌  Failed: "${row.title}" — ${error.message}`);
      failCount++;
    } else {
      console.log(`  ✅  Imported: "${row.title}" (${row.category})`);
      if (externalId) imported.add(externalId);
      newCount++;
    }

    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  if (!DRY_RUN) saveImported(imported);

  console.log(`\n────────────────────────────────`);
  console.log(`  ✅  Imported:  ${newCount}`);
  console.log(`  ⏭   Skipped:   ${skipCount}`);
  console.log(`  ❌  Failed:    ${failCount}`);
  console.log(`────────────────────────────────\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
