import type { Address } from "viem";

export interface Deployment {
  factory: Address;
  router: Address;
  merryMenShare: Address;
  lox: Address;
  bowStaking: Address;
  weth: Address;
}

export interface TokenInfo {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  /** true for the native-ETH pseudo-token entry */
  isNative?: boolean;
}

/**
 * Contract addresses per chainId. After running `forge script script/Deploy.s.sol`
 * (and optionally Seed.s.sol) against a chain, copy the addresses from
 * contracts/deployments/<chainId>.json here.
 */
export const DEPLOYMENTS: Record<number, Deployment> = {
  // Greenwood local (anvil) — regenerate with `make demo` in the repo root
  31337: {
    weth: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    factory: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    router: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
    merryMenShare: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    lox: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
    bowStaking: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
  },
  // Robinhood Chain testnet (46630): deploy, then fill in.
  // Robinhood Chain mainnet (4663): deploy, then fill in.
};

/** Known token lists per chainId (mock/demo tokens on test chains). */
export const TOKEN_LISTS: Record<number, TokenInfo[]> = {
  31337: [
    {
      address: "0x0000000000000000000000000000000000000000",
      symbol: "ETH",
      name: "Ether",
      decimals: 18,
      isNative: true,
    },
    {
      address: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
    },
    {
      address: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
      symbol: "LOX",
      name: "Loxley",
      decimals: 18,
    },
    {
      address: "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318",
      symbol: "GOLD",
      name: "Marian's Gold",
      decimals: 18,
    },
    {
      address: "0x610178dA211FEF7D417bC0e6FeD39F05609AD788",
      symbol: "SILV",
      name: "Sheriff's Silver",
      decimals: 6,
    },
    {
      address: "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e",
      symbol: "ALE",
      name: "Friar's Ale",
      decimals: 18,
    },
  ],
};

export function getDeployment(chainId: number): Deployment | undefined {
  return DEPLOYMENTS[chainId];
}

export function getTokenList(chainId: number): TokenInfo[] {
  return TOKEN_LISTS[chainId] ?? [];
}
