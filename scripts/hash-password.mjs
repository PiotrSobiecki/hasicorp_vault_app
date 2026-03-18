/**
 * Skrypt do generowania hasha hasła głównego (Argon2id).
 *
 * Użycie:
 *   node scripts/hash-password.mjs
 *
 * Wygenerowany hash wklej do .env jako:
 *   MASTER_PASSWORD_HASH=<hash>
 *
 * Usuń wtedy MASTER_PASSWORD z .env.
 */
import { createInterface } from "readline";
import { hash } from "argon2";

const rl = createInterface({ input: process.stdin, output: process.stdout });

rl.question("Podaj nowe hasło główne: ", async (password) => {
  if (!password || password.length < 12) {
    console.error("❌ Hasło musi mieć co najmniej 12 znaków.");
    process.exit(1);
  }

  const result = await hash(password, {
    type: 2,          // Argon2id
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 1,
  });

  console.log("\n✅ Hash wygenerowany. Wklej do .env:\n");
  console.log(`MASTER_PASSWORD_HASH=${result}\n`);
  console.log("Usuń MASTER_PASSWORD z .env (nie jest już potrzebny).");
  rl.close();
});
