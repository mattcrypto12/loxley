import { defineChain, type Chain } from "viem";
import { arbitrumSepolia } from "viem/chains";

/**
 * ═══════════════════════════════════════════════════════════════════
 *  LOXLEY CHAIN CONFIG — the one file to repoint the whole app.
 *
 *  Set NEXT_PUBLIC_LOXLEY_NETWORK to one of:
 *    "anvil"             local demo chain (default in dev)
 *    "robinhoodTestnet"  Robinhood Chain testnet   (chainId 46630)
 *    "robinhoodMainnet"  Robinhood Chain mainnet   (chainId 4663)
 *    "arbitrumSepolia"   fallback public testnet
 * ═══════════════════════════════════════════════════════════════════
 */

export const robinhoodTestnet = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.chain.robinhood.com"] },
  },
  blockExplorers: {
    default: {
      name: "Robinhood Chain Explorer",
      url: "https://explorer.testnet.chain.robinhood.com",
    },
  },
  testnet: true,
});

export const robinhoodMainnet = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.mainnet.chain.robinhood.com"] },
  },
  blockExplorers: {
    default: {
      name: "Robinhood Chain Explorer",
      url: "https://robinhoodchain.blockscout.com",
    },
  },
});

export const anvil = defineChain({
  id: 31337,
  name: "Greenwood (local)",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
  },
  testnet: true,
});

const NETWORKS = {
  anvil,
  robinhoodTestnet,
  robinhoodMainnet,
  arbitrumSepolia,
} as const satisfies Record<string, Chain>;

export type NetworkName = keyof typeof NETWORKS;

const networkName = (process.env.NEXT_PUBLIC_LOXLEY_NETWORK ??
  "anvil") as NetworkName;

/** The chain the app is currently pointed at. */
export const activeChain: Chain = NETWORKS[networkName] ?? anvil;

export const isLocalDemo = activeChain.id === anvil.id;
