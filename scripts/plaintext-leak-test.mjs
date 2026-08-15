import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const marker = "BROOMER_PLAINTEXT_LEAK_TEST_937462";
const roots = [".next/server", "public"];
const leaks = [];

async function scan(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await scan(target);
      continue;
    }
    const content = await readFile(target).catch(() => null);
    if (content?.includes(Buffer.from(marker))) leaks.push(target);
  }
}

for (const directory of roots) await scan(directory);
if (leaks.length > 0) {
  console.error(`Plaintext marker found in: ${leaks.join(", ")}`);
  process.exit(1);
}
console.log("Plaintext marker absent from application-controlled build and public artifacts.");