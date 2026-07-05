import type { Address } from "viem";

export interface Deployment {
  factory: Address;
  router: Address;
  merryMenShare: Address;
  lox: Address;
  bowStaking: Address;
  weth: Address;
  /** SpoilsSplitter (factory.feeTo): immutable 50/50 Share/guild split */
  feeSplitter?: Address;
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
 * All chain addresses and token lists flow from ./generated.ts, which is
 * written by scripts/sync-web-config.mjs from contracts/deployments/*.json
 * after every deploy (local `demo.sh` and public `deploy-testnet.sh` both
 * run the sync). Nothing is hand-maintained here.
 */
export const DEPLOYMENTS: Record<number, Deployment> = {};

export const TOKEN_LISTS: Record<number, TokenInfo[]> = {};

import { GENERATED_DEPLOYMENTS, GENERATED_TOKEN_LISTS } from "./generated";

export function getDeployment(chainId: number): Deployment | undefined {
  return DEPLOYMENTS[chainId] ?? GENERATED_DEPLOYMENTS[chainId];
}

export function getTokenList(chainId: number): TokenInfo[] {
  return TOKEN_LISTS[chainId] ?? GENERATED_TOKEN_LISTS[chainId] ?? [];
}
