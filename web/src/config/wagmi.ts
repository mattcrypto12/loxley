"use client";

import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { activeChain, isLocalDemo } from "./chains";
import { burner } from "@/lib/burnerConnector";

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "loxley-dev-placeholder";

const rainbowConnectors = connectorsForWallets(
  [
    {
      groupName: "Popular",
      wallets: [injectedWallet, metaMaskWallet, rainbowWallet, walletConnectWallet],
    },
  ],
  { appName: "Loxley", projectId },
);

export const wagmiConfig = createConfig({
  chains: [activeChain],
  connectors: isLocalDemo
    ? [burner({ chain: activeChain }), ...rainbowConnectors]
    : rainbowConnectors,
  transports: {
    [activeChain.id]: http(activeChain.rpcUrls.default.http[0]),
  },
  ssr: true,
});
