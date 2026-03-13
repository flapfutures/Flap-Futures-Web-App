/**
 * FFX Contract Deployment + BSCScan Verification Script
 * Run: node scripts/deploy-ffx.mjs
 *
 * Deploys all 6 FFX platform contracts in order, verifies each on BSCScan,
 * then saves deployed-addresses.json for sync-addresses.mjs.
 */

import { ethers }        from "ethers";
import solc              from "solc";
import fs                from "fs";
import path              from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, "..");

// ── Config ────────────────────────────────────────────────────────────────────
const BSC_RPC        = "https://bsc-dataseed1.binance.org/";
const USDT           = "0x55d398326f99059fF775485246999027B3197955";
const GAS_PRICE_WEI  = ethers.parseUnits("0.05", "gwei");
const GAS_LIMIT_BASE = 3_000_000n;
const BSCSCAN_KEY    = process.env.BSCSCAN_API_KEY;
const BOT_PRIVKEY    = process.env.BOT_PRIVATE_KEY;
const COMPILER_VER   = "v0.8.34+commit.80d5c536";
const EVM_VER        = "paris";

if (!BOT_PRIVKEY) { console.error("❌  BOT_PRIVATE_KEY not set"); process.exit(1); }
if (!BSCSCAN_KEY) { console.error("❌  BSCSCAN_API_KEY not set"); process.exit(1); }

const provider = new ethers.JsonRpcProvider(BSC_RPC);
const wallet   = new ethers.Wallet(BOT_PRIVKEY, provider);

console.log(`\n🔑  Deploying from: ${wallet.address}`);
const bnbBal = await provider.getBalance(wallet.address);
console.log(`💰  Balance: ${ethers.formatEther(bnbBal)} BNB\n`);

// ── Compile ───────────────────────────────────────────────────────────────────
// viaIR=true required for FFXPerps (stack too deep otherwise).
// We use it for ALL contracts for uniform verification approach.
function compile(contractFile, contractName) {
  const src = fs.readFileSync(path.join(ROOT, "contracts", contractFile), "utf8");
  const jsonInput = {
    language: "Solidity",
    sources:  { [contractFile]: { content: src } },
    settings: {
      optimizer:  { enabled: true, runs: 1 },
      viaIR:      true,
      evmVersion: EVM_VER,
      outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } },
    },
  };
  const out = JSON.parse(solc.compile(JSON.stringify(jsonInput)));
  const errs = (out.errors || []).filter(e => e.severity === "error");
  if (errs.length) { console.error("Compile error:", errs[0].message); process.exit(1); }
  const c = out.contracts[contractFile][contractName];
  console.log(`   compiled ${contractName}: ${Math.round(c.evm.bytecode.object.length/2)} bytes`);
  return { abi: c.abi, bytecode: "0x" + c.evm.bytecode.object, src, jsonInput };
}

// ── Deploy ────────────────────────────────────────────────────────────────────
async function deploy(contractName, abi, bytecode, constructorArgs = []) {
  console.log(`\n📦  Deploying ${contractName}…`);
  const factory  = new ethers.ContractFactory(abi, bytecode, wallet);
  const contract = await factory.deploy(...constructorArgs, {
    gasPrice: GAS_PRICE_WEI,
    gasLimit: GAS_LIMIT_BASE,
  });
  const txHash = contract.deploymentTransaction().hash;
  console.log(`   tx:  ${txHash}`);
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log(`   ✅  ${contractName} → ${addr}`);
  return addr;
}

// ── Verify via Standard JSON Input (supports viaIR) ──────────────────────────
async function verify(contractFile, contractName, address, constructorArgs = [], constructorArgTypes = []) {
  console.log(`\n🔍  Verifying ${contractName} (${address})…`);

  const src = fs.readFileSync(path.join(ROOT, "contracts", contractFile), "utf8");

  // BSCScan Standard JSON Input — must NOT include outputSelection
  const stdJson = JSON.stringify({
    language: "Solidity",
    sources:  { [contractFile]: { content: src } },
    settings: {
      optimizer:  { enabled: true, runs: 1 },
      viaIR:      true,
      evmVersion: EVM_VER,
    },
  });

  let encodedArgs = "";
  if (constructorArgTypes.length > 0) {
    encodedArgs = ethers.AbiCoder.defaultAbiCoder()
      .encode(constructorArgTypes, constructorArgs)
      .slice(2);
  }

  const params = new URLSearchParams({
    apikey:              BSCSCAN_KEY,
    module:              "contract",
    action:              "verifysourcecode",
    contractaddress:     address,
    sourceCode:          stdJson,
    codeformat:          "solidity-standard-json-input",
    contractname:        `${contractFile}:${contractName}`,
    compilerversion:     COMPILER_VER,
    constructorArguements: encodedArgs,
  });

  const res  = await fetch("https://api.etherscan.io/v2/api?chainid=56", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    params.toString(),
  });
  const json = await res.json();

  if (json.status !== "1") {
    console.warn(`   ⚠️  Submit failed: ${json.result}`);
    return;
  }

  const guid = json.result;
  console.log(`   guid: ${guid} — polling in 25 s…`);
  await sleep(25_000);

  const poll = await fetch(
    `https://api.etherscan.io/v2/api?chainid=56&module=contract&action=checkverifystatus&guid=${guid}&apikey=${BSCSCAN_KEY}`
  );
  const pj = await poll.json();
  const ok  = pj.result?.toLowerCase().includes("pass") || pj.result?.toLowerCase().includes("already");
  console.log(`   ${ok ? "✅" : "⚠️ "} ${pj.result}`);
}

// ── Helper: send a linking transaction ───────────────────────────────────────
async function link(label, contractAddr, abi, method, args) {
  console.log(`\n🔗  ${label}…`);
  const c  = new ethers.Contract(contractAddr, abi, wallet);
  const tx = await c[method](...args, { gasPrice: GAS_PRICE_WEI, gasLimit: 200_000n });
  await tx.wait();
  console.log(`   ✅  tx: ${tx.hash}`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ══════════════════════════════════════════════════════════════════════════════
// DEPLOYMENT SEQUENCE
// ══════════════════════════════════════════════════════════════════════════════

const BOT     = wallet.address;   // platform bot = admin = fee wallet for now
const ADMIN   = wallet.address;
const FEE_WAL = wallet.address;

// 1. FFXOracle ─────────────────────────────────────────────────────────────────
const oracleC = compile("FFXOracle.sol", "FFXOracle");
const ORACLE   = await deploy("FFXOracle", oracleC.abi, oracleC.bytecode, [BOT]);
await verify("FFXOracle.sol", "FFXOracle", ORACLE, [BOT], ["address"]);

// 2. FFXFunding ───────────────────────────────────────────────────────────────
const fundingC = compile("FFXFunding.sol", "FFXFunding");
const FUNDING   = await deploy("FFXFunding", fundingC.abi, fundingC.bytecode, [BOT, FEE_WAL]);
await verify("FFXFunding.sol", "FFXFunding", FUNDING, [BOT, FEE_WAL], ["address","address"]);

// 3. FFXVault (implementation, no args) ───────────────────────────────────────
const vaultC   = compile("FFXVault.sol", "FFXVault");
const VAULT_IMPL = await deploy("FFXVault", vaultC.abi, vaultC.bytecode, []);
await verify("FFXVault.sol", "FFXVault", VAULT_IMPL, [], []);

// 4. FFXPerps (implementation, no args) ───────────────────────────────────────
const perpsC   = compile("FFXPerps.sol", "FFXPerps");
const PERPS_IMPL = await deploy("FFXPerps", perpsC.abi, perpsC.bytecode, []);
await verify("FFXPerps.sol", "FFXPerps", PERPS_IMPL, [], []);

// 5. FFXFactory ───────────────────────────────────────────────────────────────
const factoryC   = compile("FFXFactory.sol", "FFXFactory");
const FACTORY_ARGS  = [ADMIN, ORACLE, FUNDING, FEE_WAL, VAULT_IMPL, PERPS_IMPL, USDT];
const FACTORY_TYPES = ["address","address","address","address","address","address","address"];
const FACTORY = await deploy("FFXFactory", factoryC.abi, factoryC.bytecode, FACTORY_ARGS);
await verify("FFXFactory.sol", "FFXFactory", FACTORY, FACTORY_ARGS, FACTORY_TYPES);

// 6. FFXPlatform ──────────────────────────────────────────────────────────────
const platformC    = compile("FFXPlatform.sol", "FFXPlatform");
const PLATFORM_ARGS  = [ADMIN, ORACLE, FUNDING, FACTORY];
const PLATFORM_TYPES = ["address","address","address","address"];
const PLATFORM = await deploy("FFXPlatform", platformC.abi, platformC.bytecode, PLATFORM_ARGS);
await verify("FFXPlatform.sol", "FFXPlatform", PLATFORM, PLATFORM_ARGS, PLATFORM_TYPES);

// 7. Linking transactions ─────────────────────────────────────────────────────
await link("FFXOracle.setFactory → FFXFactory",  ORACLE,   oracleC.abi,   "setFactory",         [FACTORY]);
await link("FFXFunding.setFactory → FFXFactory", FUNDING,  fundingC.abi,  "setFactory",         [FACTORY]);
await link("FFXFactory.setPlatformContract",     FACTORY,  factoryC.abi,  "setPlatformContract",[PLATFORM]);

// 8. Summary ───────────────────────────────────────────────────────────────────
console.log(`
╔══════════════════════════════════════════════════════╗
║           FFX DEPLOYMENT COMPLETE ✅                 ║
╚══════════════════════════════════════════════════════╝
FFX_ORACLE   = ${ORACLE}
FFX_FUNDING  = ${FUNDING}
FFX_FACTORY  = ${FACTORY}
FFX_PLATFORM = ${PLATFORM}

vault impl   = ${VAULT_IMPL}
perps impl   = ${PERPS_IMPL}
`);

// 9. Save for sync script ──────────────────────────────────────────────────────
const addresses = { ORACLE, FUNDING, FACTORY, PLATFORM, VAULT_IMPL, PERPS_IMPL };
fs.writeFileSync(path.join(__dirname, "deployed-addresses.json"), JSON.stringify(addresses, null, 2));
console.log("📝  Saved → scripts/deployed-addresses.json");
console.log("▶️   Next: node scripts/sync-addresses.mjs\n");
