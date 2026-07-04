"use client";

import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/config/wagmi";

const loxleyTheme = darkTheme({
  accentColor: "#e8b64c",
  accentColorForeground: "#241a05",
  borderRadius: "large",
  overlayBlur: "small",
});

loxleyTheme.colors.modalBackground = "#06150d";
loxleyTheme.colors.modalBorder = "rgba(207,227,213,0.1)";
loxleyTheme.colors.connectButtonBackground = "rgba(20,48,32,0.6)";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 4_000, refetchInterval: 8_000 } },
      }),
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={loxleyTheme} modalSize="compact">
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
