"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import {
  erc20Abi,
  formatUnits,
  maxUint256,
  type ContractFunctionParameters,
} from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContracts,
  useWriteContract,
} from "wagmi";
import { bowAbi } from "@/abi/bow";
import { TokenBadge } from "@/components/TokenBadge";
import { fmtAmount, parseAmount } from "@/lib/format";
import { useDeployment } from "@/lib/hooks";

export default function BowPage() {
  const { address: user, isConnected } = useAccount();
  const deployment = useDeployment();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bow = deployment?.bowStaking;
  const lox = deployment?.lox;

  const contracts: ContractFunctionParameters[] =
    bow && lox
      ? [
          { address: bow, abi: bowAbi, functionName: "totalStaked" },
          { address: bow, abi: bowAbi, functionName: "rewardRate" },
          { address: bow, abi: bowAbi, functionName: "periodFinish" },
          ...(user
            ? [
                { address: bow, abi: bowAbi, functionName: "stakedOf", args: [user] },
                { address: bow, abi: bowAbi, functionName: "earned", args: [user] },
                { address: lox, abi: erc20Abi, functionName: "balanceOf", args: [user] },
              ]
            : []),
        ]
      : [];

  const { data, refetch } = useReadContracts({
    contracts,
    query: { enabled: Boolean(bow && lox), refetchInterval: 6_000 },
  });

  const totalStaked = (data?.[0]?.result as bigint | undefined) ?? 0n;
  const rewardRate = (data?.[1]?.result as bigint | undefined) ?? 0n;
  const periodFinish = (data?.[2]?.result as bigint | undefined) ?? 0n;
  const myStake = (data?.[3]?.result as bigint | undefined) ?? 0n;
  const earned = (data?.[4]?.result as bigint | undefined) ?? 0n;
  const loxBalance = (data?.[5]?.result as bigint | undefined) ?? 0n;

  const streamLive = Number(periodFinish) > Date.now() / 1000;
  const apr =
    streamLive && totalStaked > 0n
      ? (Number(formatUnits(rewardRate, 18)) * 31_536_000 * 100) /
        Number(formatUnits(totalStaked, 18))
      : 0;

  const amount = parseAmount(input, 18);

  async function run(label: string, fn: () => Promise<`0x${string}`>) {
    if (!publicClient) return;
    setBusy(label);
    setError(null);
    try {
      const hash = await fn();
      await publicClient.waitForTransactionReceipt({ hash });
      setInput("");
      refetch();
    } catch (e) {
      setError(
        (e instanceof Error ? e.message : "Failed").split("\n")[0].slice(0, 120),
      );
    } finally {
      setBusy(null);
    }
  }

  async function stake() {
    if (!bow || !lox || !user || !amount || !publicClient) return;
    const allowance = await publicClient.readContract({
      address: lox,
      abi: erc20Abi,
      functionName: "allowance",
      args: [user, bow],
    });
    if (allowance < amount) {
      await run("Blessing the coin…", () =>
        writeContractAsync({
          address: lox,
          abi: erc20Abi,
          functionName: "approve",
          args: [bow, maxUint256],
        }),
      );
    }
    await run("Drawing the bow…", () =>
      writeContractAsync({
        address: bow,
        abi: bowAbi,
        functionName: "stake",
        args: [amount],
      }),
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-8 text-center">
        <h1 className="rise-in engraved text-3xl font-semibold">
          Drawing the <span className="text-gold-400 text-glow-gold">Bow</span>
        </h1>
        <p className="rise-in rise-in-1 mx-auto mt-2 max-w-md text-sm text-moon-500">
          Stake $LOX and hold the tension. Rewards stream by the second;
          loose whenever you like.
        </p>
      </header>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="Total LOX drawn" value={fmtAmount(totalStaked, 18)} />
        <Stat
          label="Stream APR"
          value={
            !streamLive
              ? "quiet"
              : totalStaked === 0n
                ? "∞ — be first"
                : `${apr.toFixed(1)}%`
          }
          accent
        />
        <Stat label="Your LOX drawn" value={fmtAmount(myStake, 18)} />
      </div>

      <div className="glass p-5">
        <div className="glass-inset p-4">
          <div className="mb-1 flex justify-between text-xs text-moon-500">
            <span>Stake LOX</span>
            <button
              type="button"
              className="hover:text-gold-400"
              onClick={() => setInput(formatUnits(loxBalance, 18))}
            >
              Purse: {fmtAmount(loxBalance, 18)} <span className="text-gold-500">MAX</span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <input
              className="amount-input !text-xl"
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <span className="flex items-center gap-2 font-semibold">
              <TokenBadge symbol="LOX" size={26} /> LOX
            </span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <motion.button
            whileTap={{ scale: 0.98 }}
            className="btn-gold py-3"
            disabled={!isConnected || !amount || amount === 0n || busy !== null}
            onClick={stake}
          >
            {busy ?? "Draw the bow"}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.98 }}
            className="btn-ghost py-3"
            disabled={!isConnected || !amount || amount === 0n || amount > myStake || busy !== null}
            onClick={() =>
              bow &&
              amount &&
              run("Easing the string…", () =>
                writeContractAsync({
                  address: bow,
                  abi: bowAbi,
                  functionName: "withdraw",
                  args: [amount],
                }),
              )
            }
          >
            Ease the string
          </motion.button>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl bg-forest-950/50 px-4 py-3">
          <div>
            <p className="text-xs text-moon-700">Accrued rewards</p>
            <p className="font-mono text-lg text-gold-400">{fmtAmount(earned, 18)} LOX</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.96 }}
            className="btn-ghost px-4 py-2 text-sm"
            disabled={!isConnected || earned === 0n || busy !== null}
            onClick={() =>
              bow &&
              run("Loosing…", () =>
                writeContractAsync({
                  address: bow,
                  abi: bowAbi,
                  functionName: "getReward",
                }),
              )
            }
          >
            Loose the arrow
          </motion.button>
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-blood-400/10 px-3 py-2 text-xs text-blood-400">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="glass-inset px-4 py-3 text-center">
      <p className="text-[0.68rem] uppercase tracking-wider text-moon-700">{label}</p>
      <p
        className={`mt-0.5 truncate font-mono text-sm ${accent ? "text-ember-400" : "text-moon-100"}`}
      >
        {value}
      </p>
    </div>
  );
}
