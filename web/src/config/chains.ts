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

/** The chain the app starts on (wallets can switch to any SUPPORTED_CHAIN). */
export const activeChain: Chain = NETWORKS[networkName] ?? anvil;

/**
 * Every chain the app can talk to. The default (env-selected) chain is
 * listed first so wagmi/RainbowKit treat it as the initial chain. In
 * production builds the local Greenwood chain is dropped entirely.
 */
const isProd = process.env.NODE_ENV === "production" && networkName !== "anvil";
const others = [robinhoodMainnet, robinhoodTestnet, arbitrumSepolia, anvil].filter(
  (c) => c.id !== activeChain.id && !(isProd && c.id === anvil.id),
);

export const SUPPORTED_CHAINS = [activeChain, ...others] as const;

export const LOCAL_CHAIN_ID = anvil.id;

/** Explorer URL for a transaction, or null if the chain has no explorer. */
export function explorerTxUrl(chainId: number, hash: string): string | null {
  const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId);
  const base = chain?.blockExplorers?.default?.url;
  return base ? `${base.replace(/\/$/, "")}/tx/${hash}` : null;
}

/** Explorer URL for an address, or null if the chain has no explorer. */
export function explorerAddressUrl(chainId: number, address: string): string | null {
  const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId);
  const base = chain?.blockExplorers?.default?.url;
  return base ? `${base.replace(/\/$/, "")}/address/${address}` : null;
}
