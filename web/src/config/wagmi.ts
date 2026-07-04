"use client";

import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  metaMaskWallet,
  rainbowWallet,
  coinbaseWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http, type Transport } from "wagmi";
import { anvil, SUPPORTED_CHAINS } from "./chains";
import { burner } from "@/lib/burnerConnector";

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "loxley-dev-placeholder";

const rainbowConnectors = connectorsForWallets(
  [
    {
      groupName: "Popular",
      wallets: [
        injectedWallet,
        metaMaskWallet,
        rainbowWallet,
        coinbaseWallet,
        walletConnectWallet,
      ],
    },
  ],
  { appName: "Loxley", projectId },
);

const supportsLocal = SUPPORTED_CHAINS.some((c) => c.id === anvil.id);

export const wagmiConfig = createConfig({
  chains: SUPPORTED_CHAINS as unknown as readonly [
    (typeof SUPPORTED_CHAINS)[number],
    ...(typeof SUPPORTED_CHAINS)[number][],
  ],
  connectors: supportsLocal
    ? [...rainbowConnectors, burner({ chain: anvil })]
    : rainbowConnectors,
  transports: Object.fromEntries(
    SUPPORTED_CHAINS.map((c) => [c.id, http(c.rpcUrls.default.http[0])]),
  ) as Record<number, Transport>,
  ssr: true,
});
