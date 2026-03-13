import { ethers } from "ethers";

export const BSC_RPC       = "https://bsc-dataseed1.binance.org";
export const BSC_CHAIN_ID  = 56;
export const ZERO_ADDR     = "0x0000000000000000000000000000000000000000";
export const WBNB          = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
export const USDT_BSC      = "0x55d398326f99059fF775485246999027B3197955";
export const FLAP_PORTAL   = "0xe2cE6ab80874Fa9Fa2aAE65D277Dd6B8e65C9De0";
export const PANCAKE_V2_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";

export const PORTAL_ABI = [
  {
    name: "getTokenV5",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{
      type: "tuple",
      components: [
        { name: "status",                  type: "uint8"   },
        { name: "reserve",                 type: "uint256" },
        { name: "circulatingSupply",       type: "uint256" },
        { name: "price",                   type: "uint256" },
        { name: "tokenVersion",            type: "uint8"   },
        { name: "r",                       type: "uint256" },
        { name: "h",                       type: "uint256" },
        { name: "k",                       type: "uint256" },
        { name: "dexSupplyThresh",         type: "uint256" },
        { name: "quoteTokenAddress",       type: "address" },
        { name: "nativeToQuoteSwapEnabled",type: "bool"    },
        { name: "extensionID",             type: "bytes32" },
      ],
    }],
  },
  {
    name: "quoteExactInput",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{
      name: "params", type: "tuple",
      components: [
        { name: "inputToken",  type: "address" },
        { name: "outputToken", type: "address" },
        { name: "inputAmount", type: "uint256" },
      ],
    }],
    outputs: [{ name: "outputAmount", type: "uint256" }],
  },
  {
    name: "swapExactInput",
    type: "function",
    stateMutability: "payable",
    inputs: [{
      name: "params", type: "tuple",
      components: [
        { name: "inputToken",      type: "address" },
        { name: "outputToken",     type: "address" },
        { name: "inputAmount",     type: "uint256" },
        { name: "minOutputAmount", type: "uint256" },
        { name: "permitData",      type: "bytes"   },
      ],
    }],
    outputs: [{ name: "outputAmount", type: "uint256" }],
  },
] as const;

export const PANCAKE_V2_ABI = [
  {
    name: "getAmountsOut",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "path",     type: "address[]" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    name: "swapExactETHForTokens",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "amountOutMin", type: "uint256" },
      { name: "path",        type: "address[]" },
      { name: "to",          type: "address"   },
      { name: "deadline",    type: "uint256"   },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    name: "swapExactTokensForETH",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountIn",    type: "uint256"   },
      { name: "amountOutMin",type: "uint256"   },
      { name: "path",        type: "address[]" },
      { name: "to",          type: "address"   },
      { name: "deadline",    type: "uint256"   },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    name: "swapExactTokensForTokens",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountIn",    type: "uint256"   },
      { name: "amountOutMin",type: "uint256"   },
      { name: "path",        type: "address[]" },
      { name: "to",          type: "address"   },
      { name: "deadline",    type: "uint256"   },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
] as const;

export const ERC20_SPOT_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount",  type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner",   type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs:  [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs:  [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

export async function ensureBSC(): Promise<ethers.BrowserProvider> {
  const w = window as any;
  if (!w.ethereum) throw new Error("No wallet detected. Install MetaMask or Trust Wallet.");
  await w.ethereum.request({ method: "eth_requestAccounts" });
  const provider = new ethers.BrowserProvider(w.ethereum);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== BSC_CHAIN_ID) {
    try {
      await w.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x38" }],
      });
    } catch (e: any) {
      if (e.code === 4902) {
        await w.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: "0x38",
            chainName: "BNB Smart Chain",
            nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
            rpcUrls: [BSC_RPC],
            blockExplorerUrls: ["https://bscscan.com"],
          }],
        });
      }
    }
    throw new Error("Please switch to BNB Smart Chain and try again.");
  }
  return provider;
}

export interface TokenState {
  status: "bonding" | "dex" | "pancake";
  quoteTokenAddress: string;
  nativeToQuoteSwapEnabled: boolean;
}

export async function getTokenState(tokenAddress: string): Promise<TokenState> {
  if (tokenAddress.toLowerCase() === WBNB.toLowerCase()) {
    return { status: "pancake", quoteTokenAddress: USDT_BSC, nativeToQuoteSwapEnabled: false };
  }
  try {
    const provider = new ethers.JsonRpcProvider(BSC_RPC);
    const portal = new ethers.Contract(FLAP_PORTAL, PORTAL_ABI, provider);
    const state = await portal.getTokenV5(tokenAddress);
    const s = Number(state.status);
    if (s === 1) {
      return {
        status: "bonding",
        quoteTokenAddress: state.quoteTokenAddress,
        nativeToQuoteSwapEnabled: state.nativeToQuoteSwapEnabled,
      };
    } else if (s === 2) {
      return { status: "dex", quoteTokenAddress: state.quoteTokenAddress, nativeToQuoteSwapEnabled: false };
    }
  } catch {}
  return { status: "pancake", quoteTokenAddress: "", nativeToQuoteSwapEnabled: false };
}
