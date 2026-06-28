#!/usr/bin/env node
/**
 * Batch-mint per-client access codes into Supabase.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node mint-codes.mjs <count> [labelPrefix]
 *
 * Examples:
 *   node mint-codes.mjs 25
 *   node mint-codes.mjs 10 "march-batch"
 *
 * Prints the newly minted codes (in hand-out order) as CSV to stdout, so you
 * can pipe to a file:  node mint-codes.mjs 25 > codes.csv
 *
 * The SERVICE_ROLE key is a server secret — never commit it, never put it in
 * the website. Find it in: Supabase dashboard → Project Settings → API.
 *
 * Requires: npm i @supabase/supabase-js   (run inside supabase/scripts)
 */
import { createClient } from "@supabase/supabase-js";
import { randomInt } from "node:crypto";

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.");
  process.exit(1);
}

const count = parseInt(process.argv[2] ?? "0", 10);
const labelPrefix = process.argv[3] ?? null;
if (!Number.isInteger(count) || count < 1 || count > 1000) {
  console.error("Usage: node mint-codes.mjs <count 1-1000> [labelPrefix]");
  process.exit(1);
}

// Unambiguous charset — no 0/O/1/I/L to avoid read-aloud confusion.
const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function block(n) {
  let s = "";
  for (let i = 0; i < n; i++) s += CHARS[randomInt(CHARS.length)];
  return s;
}
function makeCode() {
  return `CAD-${block(4)}-${block(4)}`;
}

const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

const rows = [];
const seen = new Set();
while (rows.length < count) {
  const code = makeCode();
  if (seen.has(code)) continue;
  seen.add(code);
  rows.push({
    code,
    label: labelPrefix ? `${labelPrefix}-${rows.length + 1}` : null,
  });
}

const { data, error } = await supabase
  .from("access_codes")
  .insert(rows)
  .select("seq, code, label");

if (error) {
  console.error("Insert failed:", error.message);
  process.exit(1);
}

data.sort((a, b) => a.seq - b.seq);
console.log("seq,code,label");
for (const r of data) console.log(`${r.seq},${r.code},${r.label ?? ""}`);
console.error(`\n✓ Minted ${data.length} codes.`);
