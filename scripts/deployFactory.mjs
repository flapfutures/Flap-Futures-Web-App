import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { ethers } from 'ethers';

const require = createRequire(import.meta.url);
const solc = require('solc');

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

const vaultImpl  = getContract('FlapVaultImpl.sol', 'FlapVaultImpl');
const perpsImpl  = getContract('FlapPerpsImpl.sol', 'FlapPerpsImpl');
const factory    = getContract('FlapFactory.sol',   'FlapFactory');

console.log(`FlapVaultImpl: ${(vaultImpl.bin.length-2)/2} bytes`);
console.log(`FlapPerpsImpl: ${(perpsImpl.bin.length-2)/2} bytes`);
console.log(`FlapFactory:   ${(factory.bin.length-2)/2}  bytes`);

const provider = new ethers.JsonRpcProvider('https://bsc-dataseed1.binance.org/');
const wallet   = new ethers.Wallet(process.env.BOT_PRIVATE_KEY, provider);
const bal      = await provider.getBalance(wallet.address);
const gasPrice = ethers.parseUnits('0.05', 'gwei');

console.log(`\nWallet: ${wallet.address}`);
console.log(`BNB balance: ${ethers.formatEther(bal)}`);
if (bal === 0n) { console.error('No BNB'); process.exit(1); }

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

// Step 1: Deploy FlapVaultImpl
const vaultImplAddr = await deploy('FlapVaultImpl', vaultImpl.abi, vaultImpl.bin);

// Step 2: Deploy FlapPerpsImpl
const perpsImplAddr = await deploy('FlapPerpsImpl', perpsImpl.abi, perpsImpl.bin);

// Step 3: Deploy FlapFactory with impl addresses + config
const factoryArgs = [
  vaultImplAddr,
  perpsImplAddr,
  '0xd8AE9A69FD6Fe0e1B3D40F32D6E2E4A10894e118', // botOperator
  '0xFcB317630C77bB730C52A81e6ACbD6456DB69930', // platform
  '0xbcE2B70e158F3F4c0f7368909FA7aD7dBfeF7941', // platformFeeWallet
  '0x55d398326f99059fF775485246999027B3197955', // USDT BSC
  '0x04e6D0C5c6b4BB583345c2980b8122f36BdA8144', // oracle
  '0x8eaeafdad4710585d5ad2446de3d4106023f19cf', // funding
];
const factoryAddr = await deploy('FlapFactory', factory.abi, factory.bin, factoryArgs);

const finalBal = await provider.getBalance(wallet.address);
console.log('\n===========================================');
console.log('FlapVaultImpl:', vaultImplAddr);
console.log('FlapPerpsImpl:', perpsImplAddr);
console.log('FlapFactory:  ', factoryAddr);
console.log('BNB spent:', ethers.formatEther(bal - finalBal));
console.log('===========================================');
