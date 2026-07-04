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

MIN=30000000000000000 # 0.03 ETH
if [ "$(python3 -c "print(1 if $BAL < $MIN else 0)")" = "1" ]; then
  echo "✗ Needs at least 0.03 test ETH. Fund $DEPLOYER via the faucet first:"
  echo "  https://faucet.testnet.chain.robinhood.com"
  exit 1
fi

echo "── deploying protocol ─────────────────────────────"
forge script script/Deploy.s.sol --rpc-url "$RPC_NAME" --private-key "$PRIVATE_KEY" --broadcast -q

CHAIN_ID=$(cast chain-id --rpc-url "$RPC_URL")
DEP="$CONTRACTS/deployments/$CHAIN_ID.json"

echo "── seeding demo pools (faucet budget) ─────────────"
ROUTER=$(jq -r .router "$DEP") LOX=$(jq -r .lox "$DEP") WETH=$(jq -r .weth "$DEP") \
  forge script script/SeedTestnet.s.sol --rpc-url "$RPC_NAME" --private-key "$PRIVATE_KEY" --broadcast -q

echo "── syncing web config ─────────────────────────────"
node "$ROOT/scripts/sync-web-config.mjs" "$CHAIN_ID"

echo "── done ───────────────────────────────────────────"
jq . "$DEP"
echo
echo "Restart the web app (or let HMR pick it up), switch the network"
echo "picker to this chain, and transactions are live."
