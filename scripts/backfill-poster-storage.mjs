/**
 * One-off backfill: move legacy base64 posters out of poster_images.image_data
 * and into the `posters` storage bucket, rewriting image_data to a public URL.
 *
 * Safe by default — runs as a DRY RUN unless you pass --apply.
 *
 *   node scripts/backfill-poster-storage.mjs           # report only, writes nothing
 *   node scripts/backfill-poster-storage.mjs --apply   # perform the migration
 *
 * Requires, in .env.local (or the environment):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (server-side only — never expose to the client)
 *
 * The service role key is needed because this writes to storage on behalf of
 * many users; the bucket's RLS policies only let a user write their own folder.
 *
 * Idempotent: rows whose image_data already looks like a URL are skipped, and
 * uploads use upsert, so re-running after a partial failure is safe. The script
 * never deletes anything — if something goes wrong, the base64 is still in the
 * row until the UPDATE for that row succeeds.
 */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const APPLY = process.argv.includes("--apply");
const BUCKET = "posters";

// ── Load env from .env.local without adding a dotenv dependency ──────────────
function loadEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "SUPABASE_SERVICE_ROLE_KEY is documented in .env.example but may not be\n" +
      "present in .env.local — add it before running this script.",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function isUrl(value) {
  return /^https?:\/\//i.test(value);
}

async function main() {
  console.log(APPLY ? "MODE: APPLY (will write)" : "MODE: DRY RUN (no writes)");

  const { data: rows, error } = await supabase
    .from("poster_images")
    .select("id, user_id, topic_id, style, image_data")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to read poster_images:", error.message);
    process.exit(1);
  }

  console.log(`Found ${rows.length} row(s).\n`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const label = `${row.id} (user ${row.user_id.slice(0, 8)}… topic ${row.topic_id.slice(0, 8)}… style ${row.style})`;

    if (isUrl(row.image_data)) {
      console.log(`SKIP  ${label} — already a URL`);
      skipped++;
      continue;
    }

    // Legacy rows hold bare base64 with no data: prefix, but tolerate one.
    const base64 = row.image_data.replace(/^data:image\/png;base64,/, "");
    let buffer;
    try {
      buffer = Buffer.from(base64, "base64");
    } catch {
      console.error(`FAIL  ${label} — could not decode base64`);
      failed++;
      continue;
    }

    if (!buffer.byteLength) {
      console.error(`FAIL  ${label} — decoded to zero bytes`);
      failed++;
      continue;
    }

    const objectPath = `${row.user_id}/${row.topic_id}.png`;
    const sizeKb = Math.round(buffer.byteLength / 1024);

    if (!APPLY) {
      console.log(`PLAN  ${label} — ${sizeKb} kB -> ${BUCKET}/${objectPath}`);
      migrated++;
      continue;
    }

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, buffer, {
        contentType: "image/png",
        cacheControl: "31536000",
        upsert: true,
      });

    if (uploadError) {
      console.error(`FAIL  ${label} — upload: ${uploadError.message}`);
      failed++;
      continue;
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
    if (!pub?.publicUrl) {
      console.error(`FAIL  ${label} — no public URL returned`);
      failed++;
      continue;
    }

    const publicUrl = `${pub.publicUrl}?v=${Date.now()}`;

    const { error: updateError } = await supabase
      .from("poster_images")
      .update({ image_data: publicUrl })
      .eq("id", row.id);

    if (updateError) {
      console.error(`FAIL  ${label} — update: ${updateError.message}`);
      console.error("      (object uploaded; row still holds base64 — safe to re-run)");
      failed++;
      continue;
    }

    console.log(`OK    ${label} — ${sizeKb} kB -> ${objectPath}`);
    migrated++;
  }

  console.log(
    `\n${APPLY ? "Migrated" : "Would migrate"}: ${migrated}   Skipped: ${skipped}   Failed: ${failed}`,
  );

  if (!APPLY && migrated > 0) {
    console.log("\nRe-run with --apply to perform the migration.");
  }
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Unexpected failure:", err);
  process.exit(1);
});
