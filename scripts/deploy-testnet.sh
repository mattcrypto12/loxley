#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Deploy Loxley to a PUBLIC chain (default: Robinhood Chain testnet),
# seed faucet-budget demo pools, and sync the web app config.
#
# Prereqs: the deployer key in .secrets/testnet-deployer.json must hold
# a little test ETH (faucet: https://faucet.testnet.chain.robinhood.com).
#
# Usage:
#   ./scripts/deploy-testnet.sh                     # robinhood testnet
#   RPC_NAME=arbitrum_sepolia ./scripts/deploy-testnet.sh
#   PRIVATE_KEY=0x… ./scripts/deploy-testnet.sh     # use your own key
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTRACTS="$ROOT/contracts"
RPC_NAME="${RPC_NAME:-robinhood_testnet}"

if [ -z "${PRIVATE_KEY:-}" ]; then
  PRIVATE_KEY=$(jq -r '.[0].private_key' "$ROOT/.secrets/testnet-deployer.json")
fi
DEPLOYER=$(cast wallet address "$PRIVATE_KEY")

cd "$CONTRACTS"
RPC_URL=$(grep "^$RPC_NAME" foundry.toml | sed 's/.*= *"//; s/"$//')
BAL=$(cast balance "$DEPLOYER" --rpc-url "$RPC_URL")
echo "deployer: $DEPLOYER"
echo "balance:  $(python3 -c "print($BAL/1e18)") ETH on $RPC_NAME"

# budget: ~3.35× ETH_PER_POOL goes into pools/swaps, plus a gas cushion
export ETH_PER_POOL="${ETH_PER_POOL:-5000000000000000}" # default 0.005 ETH
MIN=$(python3 -c "print(int($ETH_PER_POOL * 3.5) + 1000000000000000)")
if [ "$(python3 -c "print(1 if $BAL < $MIN else 0)")" = "1" ]; then
  echo "✗ Needs at least $(python3 -c "print($MIN/1e18)") ETH for ETH_PER_POOL=$(python3 -c "print($ETH_PER_POOL/1e18)")."
  echo "  Fund $DEPLOYER via https://faucet.testnet.chain.robinhood.com"
  echo "  or rerun with a smaller ETH_PER_POOL (wei), e.g.:"
  echo "  ETH_PER_POOL=2000000000000000 ./scripts/deploy-testnet.sh"
  exit 1
fi

# Orbit chains add a fluctuating L1-data-fee component to gas; estimates
# made at simulation time need real headroom or txs die out-of-gas mid-run.
GAS_MULT=200 # percent

CHAIN_ID=$(cast chain-id --rpc-url "$RPC_URL")
DEP="$CONTRACTS/deployments/$CHAIN_ID.json"

if [ -f "$DEP" ] && [ "$(cast code "$(jq -r .router "$DEP")" --rpc-url "$RPC_URL")" != "0x" ]; then
  echo "── protocol already live on chain $CHAIN_ID — skipping deploy ──"
else
  echo "── deploying protocol ─────────────────────────────"
  forge script script/Deploy.s.sol --rpc-url "$RPC_NAME" --private-key "$PRIVATE_KEY" \
    --broadcast --gas-estimate-multiplier $GAS_MULT -q
fi

echo "── seeding demo pools (faucet budget) ─────────────"
ROUTER=$(jq -r .router "$DEP") LOX=$(jq -r .lox "$DEP") WETH=$(jq -r .weth "$DEP") BOW=$(jq -r .bowStaking "$DEP") \
  forge script script/SeedTestnet.s.sol --rpc-url "$RPC_NAME" --private-key "$PRIVATE_KEY" \
    --broadcast --gas-estimate-multiplier $GAS_MULT -q

echo "── syncing web config ─────────────────────────────"
node "$ROOT/scripts/sync-web-config.mjs" "$CHAIN_ID"

echo "── done ───────────────────────────────────────────"
jq . "$DEP"
echo
echo "Restart the web app (or let HMR pick it up), switch the network"
echo "picker to this chain, and transactions are live."
