import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const scanRoots = ["src", "public"];
const textExtensions = new Set([".css", ".html", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const violations = [];
const warnings = [];

const forbiddenSourcePatterns = [
  ["analytics or session replay", /google-analytics|gtag\(|hotjar|clarity|fullstory|mixpanel|amplitude/i],
  ["service worker or CacheStorage", /serviceWorker|ServiceWorker|caches\.open|CacheStorage/],
  ["push notifications", /PushManager|Notification\.requestPermission|new Notification/],
  ["WebRTC", /RTCPeerConnection|RTCDataChannel|\bSTUN\b|\bTURN\b/],
  ["geolocation", /navigator\.geolocation/],
  ["camera or microphone", /getUserMedia|getDisplayMedia/],
  ["sensitive console logging", /console\.(log|debug|info|warn|error)\s*\(/],
  ["persistent browser storage", /localStorage|sessionStorage|indexedDB|IndexedDB/],
  ["debugger statement", /\bdebugger\s*;/],
];

async function collectFiles(directory) {
  const absolute = path.join(root, directory);
  const entries = await readdir(absolute, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(
    entries.map((entry) => {
      const relative = path.join(directory, entry.name);
      return entry.isDirectory() ? collectFiles(relative) : [relative];
    }),
  );
  return nested.flat();
}

const files = (await Promise.all(scanRoots.map(collectFiles)))
  .flat()
  .filter((file) => textExtensions.has(path.extname(file)));

for (const file of files) {
  const content = await readFile(path.join(root, file), "utf8");
  for (const [label, pattern] of forbiddenSourcePatterns) {
    if (pattern.test(content)) violations.push(`${file}: ${label}`);
  }

  for (const match of content.matchAll(/https?:\/\/([^/"'\s)]+)/g)) {
    const hostname = match[1].toLowerCase();
    if (!hostname.endsWith(".supabase.co")) {
      warnings.push(`${file}: unknown external hostname ${hostname}`);
    }
  }
}

const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const packages = { ...packageJson.dependencies, ...packageJson.devDependencies };
for (const packageName of Object.keys(packages)) {
  if (/analytics|hotjar|clarity|fullstory|mixpanel|amplitude|sentry/i.test(packageName)) {
    violations.push(`package.json: tracking or monitoring package ${packageName}`);
  }
}

const nextConfig = await readFile(path.join(root, "next.config.ts"), "utf8");
for (const header of [
  "Content-Security-Policy",
  "Strict-Transport-Security",
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Permissions-Policy",
]) {
  if (!nextConfig.includes(header)) violations.push(`next.config.ts: missing ${header}`);
}

for (const name of Object.keys(process.env)) {
  if (
    name.startsWith("NEXT_PUBLIC_") &&
    /SERVICE_ROLE|SECRET|PASSWORD|PRIVATE|MASTER_KEY|JWT/i.test(name)
  ) {
    violations.push(`environment: privileged variable exposed as ${name}`);
  }
}

const marker = ["BROOMER", "PLAINTEXT", "LEAK", "TEST", "937462"].join("_");
for (const file of files) {
  const content = await readFile(path.join(root, file), "utf8");
  if (content.includes(marker)) violations.push(`${file}: plaintext leak marker found`);
}

for (const warning of [...new Set(warnings)]) console.warn(`WARN ${warning}`);
for (const violation of [...new Set(violations)]) console.error(`FAIL ${violation}`);

if (violations.length > 0) process.exit(1);
console.log(`Privacy audit passed (${files.length} application files scanned).`);