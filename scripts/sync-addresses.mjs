/**
 * FFX Address Sync Script
 * Run AFTER deploy-ffx.mjs:  node scripts/sync-addresses.mjs
 *
 * Reads scripts/deployed-addresses.json and syncs to:
 *   1. client/src/lib/perps-contracts.ts
 *   2. VPS .env  (via SSH)
 *   3. GitHub    (flapfutures/Flap-Futures-Web-App)
 */

import fs   from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, "..");

const addrFile = path.join(__dirname, "deployed-addresses.json");
if (!fs.existsSync(addrFile)) {
  console.error("❌  deployed-addresses.json not found — run deploy-ffx.mjs first");
  process.exit(1);
}

const { ORACLE, FUNDING, FACTORY, PLATFORM, VAULT_IMPL, PERPS_IMPL } =
  JSON.parse(fs.readFileSync(addrFile, "utf8"));

console.log(`\nSyncing addresses:
  FFX_ORACLE   = ${ORACLE}
  FFX_FUNDING  = ${FUNDING}
  FFX_FACTORY  = ${FACTORY}
  FFX_PLATFORM = ${PLATFORM}
`);

// ── 1. perps-contracts.ts ─────────────────────────────────────────────────────
// Format: PLATFORM:   "",  /  ORACLE:     "",  etc. inside FFX_CONTRACTS object
const contractsFile = path.join(ROOT, "client/src/lib/perps-contracts.ts");
let ct = fs.readFileSync(contractsFile, "utf8");

function replaceFFXKey(content, key, value) {
  // Matches e.g.  PLATFORM:   "",   or   ORACLE:     "",
  const rx = new RegExp(`(\\b${key}\\s*:\\s*")[^"]*(")`,"g");
  if (!rx.test(content)) {
    console.warn(`  ⚠️  Key not found in perps-contracts.ts: ${key}`);
    return content;
  }
  return content.replace(new RegExp(`(\\b${key}\\s*:\\s*")[^"]*(")`,"g"), `$1${value}$2`);
}

ct = replaceFFXKey(ct, "PLATFORM",   PLATFORM);
ct = replaceFFXKey(ct, "ORACLE",     ORACLE);
ct = replaceFFXKey(ct, "FUNDING",    FUNDING);
ct = replaceFFXKey(ct, "FACTORY",    FACTORY);
ct = replaceFFXKey(ct, "VAULT_IMPL", VAULT_IMPL);
ct = replaceFFXKey(ct, "PERPS_IMPL", PERPS_IMPL);
ct = ct.replace(/(PLATFORM_BOT_WALLET\s*=\s*")[^"]*(")/, `$1${process.env.BOT_WALLET || ""}$2`);
fs.writeFileSync(contractsFile, ct);
console.log("✅  client/src/lib/perps-contracts.ts updated");

// ── 2. Local .env (if exists) ─────────────────────────────────────────────────
const envFile = path.join(ROOT, ".env");
if (fs.existsSync(envFile)) {
  let env = fs.readFileSync(envFile, "utf8");
  function setEnv(content, key, value) {
    const rx = new RegExp(`^${key}=.*$`, "m");
    if (rx.test(content)) return content.replace(rx, `${key}=${value}`);
    return content + `\n${key}=${value}`;
  }
  env = setEnv(env, "FFX_ORACLE",   ORACLE);
  env = setEnv(env, "FFX_FUNDING",  FUNDING);
  env = setEnv(env, "FFX_FACTORY",  FACTORY);
  env = setEnv(env, "FFX_PLATFORM", PLATFORM);
  fs.writeFileSync(envFile, env);
  console.log("✅  local .env updated");
}

// ── 3. VPS .env via SSH ───────────────────────────────────────────────────────
const VPS_HOST = "104.207.70.184";
const VPS_USER = "root";
const VPS_PASS = "23CJkG0qw928obJdKP";
const VPS_ENV  = "/root/flapfutures/.env";

console.log("\n🌐  Syncing to VPS…");
try {
  const setRemoteEnv = (key, value) => {
    const cmd = `sshpass -p '${VPS_PASS}' ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} ` +
      `"grep -q '^${key}=' ${VPS_ENV} && sed -i 's|^${key}=.*|${key}=${value}|' ${VPS_ENV} || echo '${key}=${value}' >> ${VPS_ENV}"`;
    execSync(cmd, { stdio: "pipe" });
  };
  setRemoteEnv("FFX_ORACLE",   ORACLE);
  setRemoteEnv("FFX_FUNDING",  FUNDING);
  setRemoteEnv("FFX_FACTORY",  FACTORY);
  setRemoteEnv("FFX_PLATFORM", PLATFORM);
  execSync(
    `sshpass -p '${VPS_PASS}' ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} ` +
    `"pm2 restart flapfutures --update-env"`,
    { stdio: "pipe" }
  );
  console.log("✅  VPS .env updated + PM2 restarted");
} catch (e) {
  console.warn("⚠️  VPS sync failed:", e.message?.slice(0, 120));
}

// ── 4. GitHub ─────────────────────────────────────────────────────────────────
const GH_TOKEN = process.env.GITHUB_TOKEN;
if (!GH_TOKEN) {
  console.warn("⚠️  GITHUB_TOKEN not set — skipping GitHub sync");
} else {
  const REPO   = "flapfutures/Flap-Futures-Web-App";
  const BRANCH = "main";
  const headers = {
    Authorization: `Bearer ${GH_TOKEN}`,
    "Content-Type": "application/json",
  };

  async function ghGetSha(filePath) {
    const r = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${filePath}?ref=${BRANCH}`,
      { headers }
    );
    if (!r.ok) return null;
    return (await r.json()).sha;
  }

  async function ghUpsert(filePath, localPath, message) {
    const content = fs.readFileSync(path.join(ROOT, localPath), "utf8");
    const encoded = Buffer.from(content).toString("base64");
    const sha     = await ghGetSha(filePath);
    const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${filePath}`, {
      method:  "PUT",
      headers,
      body:    JSON.stringify({ message, content: encoded, branch: BRANCH, ...(sha ? { sha } : {}) }),
    });
    const j = await r.json();
    if (r.ok) console.log(`✅  GitHub: ${filePath} ${sha ? "updated" : "created"}`);
    else       console.warn(`⚠️  GitHub: ${filePath} failed — ${j.message}`);
  }

  console.log("\n📤  Syncing to GitHub…");
  await ghUpsert(
    "client/src/lib/perps-contracts.ts",
    "client/src/lib/perps-contracts.ts",
    "feat: fill deployed FFX contract addresses"
  );
  // Also push all FFX contracts (latest source matches deployment)
  for (const sol of ["FFXOracle","FFXFunding","FFXVault","FFXPerps","FFXFactory","FFXPlatform"]) {
    await ghUpsert(
      `contracts/${sol}.sol`,
      `contracts/${sol}.sol`,
      `chore: sync ${sol}.sol post-deployment`
    );
  }
}

console.log(`
╔══════════════════════════════════════════════════════╗
║              SYNC COMPLETE                           ║
╚══════════════════════════════════════════════════════╝
Next step: Go to dev88 panel → "Setup Platform Links"
`);
