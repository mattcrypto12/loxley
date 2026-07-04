import { createConnector } from "wagmi";
import {
  createWalletClient,
  http,
  type Chain,
  type EIP1193RequestFn,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

/**
 * A pre-funded local wallet for the Greenwood demo chain (anvil key #1).
 * Lets anyone run the full swap/LP/claim experience with zero extension
 * setup. Never enabled outside the local chain.
 */
export const DEMO_PRIVATE_KEY: Hex =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

export function burner({ chain }: { chain: Chain }) {
  const account = privateKeyToAccount(DEMO_PRIVATE_KEY);
  const rpcUrl = chain.rpcUrls.default.http[0];

  return createConnector<{ request: EIP1193RequestFn }>((config) => {
    const client = createWalletClient({
      account,
      chain,
      transport: http(rpcUrl),
    });

    const request: EIP1193RequestFn = (async ({ method, params }) => {
      if (method === "eth_accounts" || method === "eth_requestAccounts") {
        return [account.address];
      }
      if (method === "eth_chainId") {
        return `0x${chain.id.toString(16)}`;
      }
      if (method === "eth_sendTransaction") {
        const tx = (params as [Record<string, Hex | undefined>])[0];
        return client.sendTransaction({
          to: tx.to as `0x${string}` | undefined,
          data: tx.data,
          value: tx.value ? BigInt(tx.value) : undefined,
          gas: tx.gas ? BigInt(tx.gas) : undefined,
          account,
          chain,
        });
      }
      if (method === "personal_sign") {
        const [message] = params as [Hex, Hex];
        return client.signMessage({ account, message: { raw: message } });
      }
      // read methods go straight to the RPC
      return client.transport.request({ method, params });
    }) as EIP1193RequestFn;

    return {
      id: "greenwoodDemo",
      name: "Greenwood Demo Wallet",
      type: "burner" as const,
      async connect({ withCapabilities }: { withCapabilities?: boolean } = {}) {
        config.emitter.emit("change", {
          accounts: [account.address],
          chainId: chain.id,
        });
        const accounts = withCapabilities
          ? [{ address: account.address, capabilities: {} }]
          : [account.address];
        return { accounts: accounts as never, chainId: chain.id };
      },
      async disconnect() {
        config.emitter.emit("disconnect");
      },
      async getAccounts() {
        return [account.address];
      },
      async getChainId() {
        return chain.id;
      },
      async getProvider() {
        return { request };
      },
      async isAuthorized() {
        return false; // require explicit connect each session
      },
      onAccountsChanged() {},
      onChainChanged() {},
      onDisconnect() {},
      async switchChain({ chainId }) {
        const target = config.chains.find((c) => c.id === chainId);
        if (!target) throw new Error(`Chain ${chainId} not configured`);
        return target;
      },
    };
  });
}
