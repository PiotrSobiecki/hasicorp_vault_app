#!/usr/bin/env node
/**
 * Vault Manager — setup script
 *
 * Generates a Secret Key and computes the Argon2id hash of the master password.
 *
 * Usage:
 *   node scripts/setup.mjs
 *
 * With an existing Secret Key (e.g. when rotating the master password):
 *   node scripts/setup.mjs --secret-key SK-ABCDE-FGHIJ-KLMNO-PQRST-UVWXY
 */

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { randomBytes } from "node:crypto";
import argon2 from "argon2";

// ── Secret Key generation ────────────────────────────────────
// Base32 charset (RFC 4648, uppercase, no ambiguous chars)
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function generateSecretKey() {
  const groups = [];
  for (let g = 0; g < 5; g++) {
    let group = "";
    // Rejection sampling — no modulo bias
    while (group.length < 5) {
      const buf = randomBytes(10);
      for (const b of buf) {
        // Accept only values < 224 (floor(256/32)*32) to avoid bias
        if (b < 224 && group.length < 5) {
          group += BASE32[b % 32];
        }
      }
    }
    groups.push(group);
  }
  return "SK-" + groups.join("-");
}

// ── Main ─────────────────────────────────────────────────────
const rl = createInterface({ input, output });

console.log("\n┌─────────────────────────────────────────┐");
console.log("│     Vault Manager — Setup & Key Gen      │");
console.log("└─────────────────────────────────────────┘\n");

// Detect existing secret key from CLI arg
const skArgIndex = process.argv.indexOf("--secret-key");
let secretKey =
  skArgIndex !== -1 && process.argv[skArgIndex + 1]
    ? process.argv[skArgIndex + 1]
    : null;

if (secretKey) {
  console.log(`Using provided Secret Key: ${secretKey}\n`);
} else {
  secretKey = generateSecretKey();
  console.log("Generated Secret Key (store in Emergency Kit!):");
  console.log(`  ${secretKey}\n`);
}

const masterPassword = await rl.question("Enter master password: ");
if (!masterPassword) {
  console.error("Master password cannot be empty.");
  process.exit(1);
}

// Secret Key is combined with master password before hashing
const combined = `${secretKey}:${masterPassword}`;

console.log("\nHashing with Argon2id (this may take a moment)…");

const hash = await argon2.hash(combined, {
  type: argon2.argon2id,
  memoryCost: 65536,   // 64 MB
  timeCost: 3,
  parallelism: 4,
});

rl.close();

console.log("\n┌─────────────────────────────────────────┐");
console.log("│     Add these to your .env file          │");
console.log("└─────────────────────────────────────────┘");
console.log("");
console.log("SECRET_KEY_REQUIRED=true");
console.log(`MASTER_PASSWORD_HASH=${hash}`);
console.log("");
console.log("─── Emergency Kit (store offline!) ────────");
console.log(`Secret Key: ${secretKey}`);
console.log("");
console.log("⚠  Remove MASTER_PASSWORD= from .env if present.");
console.log("⚠  The Secret Key must be added to NEXT_PUBLIC_SECRET_KEY_REQUIRED=true");
console.log("   in .env so the login page shows the Secret Key field.\n");
