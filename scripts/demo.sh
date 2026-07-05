#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Loxley local demo: anvil chain + full deploy + seeded pools + 14
# days of synthetic trading history for the analytics charts.
#
# Usage:  ./scripts/demo.sh          (expects anvil already running)
#         RPC=http://127.0.0.1:8545 ./scripts/demo.sh
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

RPC="${RPC:-http://127.0.0.1:8545}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTRACTS="$ROOT/contracts"

MNEMONIC="test test test test test test test test test test test junk"
DEPLOYER_PK=$(cast wallet private-key "$MNEMONIC" 0)
DEMO_PK=$(cast wallet private-key "$MNEMONIC" 1)
DEMO_ADDR=$(cast wallet address "$DEMO_PK")

echo "── deploying protocol ─────────────────────────────"
cd "$CONTRACTS"
forge script script/Deploy.s.sol --rpc-url "$RPC" --private-key "$DEPLOYER_PK" --broadcast -q

CHAIN_ID=$(cast chain-id --rpc-url "$RPC")
DEP="$CONTRACTS/deployments/$CHAIN_ID.json"
FACTORY=$(jq -r .factory "$DEP")
ROUTER=$(jq -r .router "$DEP")
LOX=$(jq -r .lox "$DEP")
WETH=$(jq -r .weth "$DEP")

echo "── seeding hoards + demo wallet ($DEMO_ADDR) ──────"
FACTORY=$FACTORY ROUTER=$ROUTER LOX=$LOX WETH=$WETH DEMO_WALLET=$DEMO_ADDR \
  forge script script/Seed.s.sol --rpc-url "$RPC" --private-key "$DEPLOYER_PK" --broadcast -q

TOKENS="$CONTRACTS/deployments/$CHAIN_ID.tokens.json"
GOLD=$(jq -r .gold "$TOKENS")
SILV=$(jq -r .silver "$TOKENS")
ALE=$(jq -r .ale "$TOKENS")

DEADLINE=99999999999
ME=$(cast wallet address "$DEPLOYER_PK")

swap_eth_for () { # value_wei token
  cast send "$ROUTER" "swapExactETHForTokens(uint256,address[],address,uint256)" \
    0 "[$WETH,$2]" "$ME" $DEADLINE --value "$1" \
    --rpc-url "$RPC" --private-key "$DEPLOYER_PK" -q > /dev/null 2>&1 || true
}

swap_tokens () { # amount tokenIn tokenOut
  cast send "$ROUTER" "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)" \
    "$1" 0 "[$2,$3]" "$ME" $DEADLINE \
    --rpc-url "$RPC" --private-key "$DEPLOYER_PK" -q > /dev/null 2>&1 || true
}

echo "── weaving 14 days of trading history ─────────────"
# walk the chain clock back-to-front: 14 daily batches with varying intensity
for day in $(seq 1 14); do
  # pseudo-random-ish intensity per day (1..4 rounds)
  ROUNDS=$(( (day * 7 % 4) + 1 ))
  for r in $(seq 1 $ROUNDS); do
    swap_eth_for  $(( 100000000000000000 * ((day + r) % 5 + 1) )) "$GOLD"   # 0.1–0.5 ETH
    swap_tokens   $(( 80000000000000000000 * (r) ))               "$GOLD" "$SILV"
    swap_eth_for  $(( 50000000000000000 * ((day * r) % 4 + 1) ))  "$LOX"
    swap_tokens   $(( 300000000000000000000 * (r) ))              "$ALE" "$GOLD"
    if [ $((day % 2)) -eq 0 ]; then
      swap_tokens $(( 120000000 * (r) )) "$SILV" "$GOLD"                    # 6-dec SILV
    fi
  done
  # demo wallet trades during epoch 1 (days 8–14) so it has claimable
  # spoils once that epoch is finalized
  if [ "$day" -eq 10 ] || [ "$day" -eq 12 ]; then
    cast send "$ROUTER" "swapExactETHForTokens(uint256,address[],address,uint256)" \
      0 "[$WETH,$GOLD]" "$DEMO_ADDR" $DEADLINE --value 150000000000000000 \
      --rpc-url "$RPC" --private-key "$DEMO_PK" -q > /dev/null 2>&1 || true
  fi
  cast rpc evm_increaseTime 86400 --rpc-url "$RPC" > /dev/null
  cast rpc evm_mine --rpc-url "$RPC" > /dev/null
  printf "  day %02d: %d round(s)\n" "$day" "$ROUNDS"
done

# a fresh batch "today" so 24h volume is live on every pool
for r in 1 2; do
  swap_eth_for  300000000000000000 "$GOLD"
  swap_tokens   150000000000000000000 "$GOLD" "$SILV"
  swap_eth_for  200000000000000000 "$LOX"
  swap_tokens   500000000000000000000 "$ALE" "$GOLD"
  swap_tokens   200000000 "$SILV" "$GOLD"
done

# a liquidity nudge so _mintFee runs and the splitter receives protocol LP
cast send "$ROUTER" "addLiquidityETH(address,uint256,uint256,uint256,address,uint256)" \
  "$GOLD" 1000000000000000000000 0 0 "$ME" $DEADLINE --value 500000000000000000 \
  --rpc-url "$RPC" --private-key "$DEPLOYER_PK" -q > /dev/null

# run the split so the Merry Men's chest (and guild treasury) fill visibly
SPLITTER=$(jq -r '.feeSplitter // empty' "$DEP")
if [ -n "$SPLITTER" ]; then
  N=$(cast call "$FACTORY" "allHoardsLength()(uint256)" --rpc-url "$RPC" | cut -d' ' -f1)
  PAIRS=""
  for i in $(seq 0 $((N-1))); do
    P=$(cast call "$FACTORY" "allHoards(uint256)(address)" "$i" --rpc-url "$RPC")
    PAIRS="$PAIRS${PAIRS:+,}$P"
  done
  cast send "$SPLITTER" "split(address[])" "[$PAIRS]" \
    --rpc-url "$RPC" --private-key "$DEPLOYER_PK" -q > /dev/null
  echo "spoils split across $N hoards (½ Share, ½ guild)"
fi

# fund a 7-day Drawing-the-Bow reward stream (70k LOX)
BOW=$(jq -r .bowStaking "$DEP")
cast send "$LOX" "mint(address,uint256)" "$BOW" 70000000000000000000000 \
  --rpc-url "$RPC" --private-key "$DEPLOYER_PK" -q > /dev/null
cast send "$BOW" "notifyRewardAmount(uint256)" 70000000000000000000000 \
  --rpc-url "$RPC" --private-key "$DEPLOYER_PK" -q > /dev/null

# demo wallet performs one swap so it has activity points out of the box
cast send "$ROUTER" "swapExactETHForTokens(uint256,address[],address,uint256)" \
  0 "[$WETH,$GOLD]" "$DEMO_ADDR" $DEADLINE --value 200000000000000000 \
  --rpc-url "$RPC" --private-key "$DEMO_PK" -q > /dev/null

# drain the demo wallet below the 1 ETH wealth threshold so the Merry Men's
# Share claim flow is fully demoable (anvil accounts start with 10,000 ETH)
DEMO_BAL=$(cast balance "$DEMO_ADDR" --rpc-url "$RPC")
KEEP=800000000000000000 # 0.8 ETH
SEND=$(python3 -c "print($DEMO_BAL - $KEEP)")
cast send "$ME" --value "$SEND" \
  --rpc-url "$RPC" --private-key "$DEMO_PK" -q > /dev/null
echo "demo wallet balance: $(cast balance "$DEMO_ADDR" --rpc-url "$RPC" | python3 -c 'import sys; print(int(sys.stdin.read())/1e18, "ETH")')"

echo "── syncing web config ─────────────────────────────"
node "$ROOT/scripts/sync-web-config.mjs"

echo "── done ───────────────────────────────────────────"
echo "chainId:   $CHAIN_ID"
echo "factory:   $FACTORY"
echo "router:    $ROUTER"
echo "demo user: $DEMO_ADDR"
echo
echo "web config auto-synced (generated.ts)"
