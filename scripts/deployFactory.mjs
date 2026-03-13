import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { ethers } from 'ethers';

const require = createRequire(import.meta.url);
const solc = require('solc');

// ── Config (set in .env before running) ─────────────────────────────────────
const BOT_OPERATOR     = process.env.BOT_OPERATOR_ADDRESS;     // wallet that posts prices
const PLATFORM_ADDRESS = process.env.PLATFORM_ADDRESS;         // FlapPlatform contract
const PLATFORM_FEE_WALLET = process.env.PLATFORM_FEE_WALLET;  // receives platform fees
const USDT_ADDRESS     = "0x55d398326f99059fF775485246999027B3197955"; // BSC USDT (fixed)
const ORACLE_ADDRESS   = process.env.FFX_ORACLE;               // FlapOracle
const FUNDING_ADDRESS  = process.env.FFX_FUNDING;              // FlapFunding

if (!BOT_OPERATOR || !PLATFORM_ADDRESS || !PLATFORM_FEE_WALLET || !ORACLE_ADDRESS || !FUNDING_ADDRESS) {
  console.error("Missing required env vars. See .env.example");
  process.exit(1);
}

function load(name) { return readFileSync(`contracts/local/${name}`, 'utf8'); }

const input = {
  language: 'Solidity',
  sources: {
    'FlapParams.sol':    { content: load('FlapParams.sol')    },
    'FlapVaultImpl.sol': { content: load('FlapVaultImpl.sol') },
    'FlapPerpsImpl.sol': { content: load('FlapPerpsImpl.sol') },
    'FlapFactory.sol':   { content: load('FlapFactory.sol')   },
  },
  settings: {
    optimizer: { enabled: true, runs: 1 },
    evmVersion: 'paris',
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } }
  }
};

console.log('Compiling with solc', solc.version(), '...');
const out = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (out.errors || []).filter(e => e.severity === 'error');
if (errors.length) { errors.forEach(e => console.error(e.formattedMessage)); process.exit(1); }

function getContract(file, name) {
  const c = out.contracts[file][name];
  return { abi: c.abi, bin: '0x' + c.evm.bytecode.object };
}

const vaultImpl = getContract('FlapVaultImpl.sol', 'FlapVaultImpl');
const perpsImpl = getContract('FlapPerpsImpl.sol', 'FlapPerpsImpl');
const factory   = getContract('FlapFactory.sol',   'FlapFactory');

console.log(`FlapVaultImpl: ${(vaultImpl.bin.length-2)/2} bytes`);
console.log(`FlapPerpsImpl: ${(perpsImpl.bin.length-2)/2} bytes`);
console.log(`FlapFactory:   ${(factory.bin.length-2)/2} bytes`);

const provider = new ethers.JsonRpcProvider('https://bsc-dataseed1.binance.org/');
const wallet   = new ethers.Wallet(process.env.BOT_PRIVATE_KEY, provider);
const bal      = await provider.getBalance(wallet.address);
const gasPrice = ethers.parseUnits('0.05', 'gwei');

console.log(`\nWallet: ${wallet.address}`);
console.log(`BNB balance: ${ethers.formatEther(bal)}`);
if (bal === 0n) { console.error('No BNB — fund your bot wallet first'); process.exit(1); }

async function deploy(label, abi, bin, args = []) {
  const cf = new ethers.ContractFactory(abi, bin, wallet);
  const deployTx = await cf.getDeployTransaction(...args);
  const est = await provider.estimateGas({ ...deployTx, from: wallet.address });
  const lim = est * 120n / 100n;
  console.log(`\n[${label}] gas estimate: ${est} | sending...`);
  const contract = await cf.deploy(...args, { gasLimit: lim, gasPrice });
  console.log(`[${label}] tx: ${contract.deploymentTransaction().hash}`);
  const receipt = await contract.deploymentTransaction().wait(2);
  const addr = await contract.getAddress();
  console.log(`[${label}] deployed at: ${addr} (gas used: ${receipt.gasUsed})`);
  return addr;
}

const vaultImplAddr = await deploy('FlapVaultImpl', vaultImpl.abi, vaultImpl.bin);
const perpsImplAddr = await deploy('FlapPerpsImpl', perpsImpl.abi, perpsImpl.bin);

const factoryArgs = [
  vaultImplAddr, perpsImplAddr,
  BOT_OPERATOR, PLATFORM_ADDRESS, PLATFORM_FEE_WALLET,
  USDT_ADDRESS, ORACLE_ADDRESS, FUNDING_ADDRESS,
];
const factoryAddr = await deploy('FlapFactory', factory.abi, factory.bin, factoryArgs);

const finalBal = await provider.getBalance(wallet.address);
console.log('\n===========================================');
console.log('FlapVaultImpl:', vaultImplAddr);
console.log('FlapPerpsImpl:', perpsImplAddr);
console.log('FlapFactory:  ', factoryAddr);
console.log('BNB spent:', ethers.formatEther(bal - finalBal));
console.log('===========================================');
console.log('\nAdd these to your .env:');
console.log(`FFX_FACTORY=${factoryAddr}`);
