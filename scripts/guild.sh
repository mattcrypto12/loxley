#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Loxley Guild Console — interactive treasury operations.
#
# Prompts for everything it needs. Private keys are read with hidden
# input, kept only in this process's memory, never written to disk,
# never passed on a command line you typed (so no shell history).
#
# Usage: ./scripts/guild.sh
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEADLINE=99999999999

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
gold() { printf '\033[33m%s\033[0m\n' "$*"; }
dim()  { printf '\033[2m%s\033[0m\n' "$*"; }
err()  { printf '\033[31m%s\033[0m\n' "$*"; }

fmt_eth() { python3 -c "print(f'{$1/1e18:.6f}')"; }

# ── 1. pick a network ────────────────────────────────────────────
bold "═══ Loxley Guild Console ═══"
echo
echo "Which network?"
echo "  1) Robinhood Chain testnet (46630)   [default]"
echo "  2) Local Greenwood (anvil, 31337)"
echo "  3) Robinhood Chain MAINNET (4663)"
printf "> "
read -r NET_CHOICE
case "${NET_CHOICE:-1}" in
  2) RPC="http://127.0.0.1:8545"; CHAIN_ID=31337; EXPLORER="" ;;
  3) RPC="https://rpc.mainnet.chain.robinhood.com"; CHAIN_ID=4663; EXPLORER="https://robinhoodchain.blockscout.com"
     err "⚠ MAINNET selected — real funds. Every action will ask again."; ;;
  *) RPC="https://rpc.testnet.chain.robinhood.com"; CHAIN_ID=46630; EXPLORER="https://explorer.testnet.chain.robinhood.com" ;;
esac

DEP="$ROOT/contracts/deployments/$CHAIN_ID.json"
if [ ! -f "$DEP" ]; then
  err "No deployment record at $DEP — deploy first."; exit 1
fi

FACTORY=$(jq -r .factory "$DEP")
ROUTER=$(jq -r .router "$DEP")
SHARE=$(jq -r .merryMenShare "$DEP")
SPLITTER=$(jq -r '.feeSplitter // empty' "$DEP")
dim "factory   $FACTORY"
dim "router    $ROUTER"
dim "share     $SHARE"
dim "splitter  ${SPLITTER:-<none — deploy AddSplitter first>}"
echo

# ── key handling ─────────────────────────────────────────────────
SIGNER_PK=""
SIGNER_ADDR=""

get_signer() {
  if [ -n "$SIGNER_PK" ]; then return; fi
  local saved="$ROOT/.secrets/testnet-deployer.json"
  if [ "$CHAIN_ID" != "4663" ] && [ -f "$saved" ]; then
    printf "Use the saved testnet deployer key (%s)? [Y/n] " \
      "$(jq -r '.[0].address' "$saved")"
    read -r USE_SAVED
    if [ "${USE_SAVED:-Y}" != "n" ] && [ "${USE_SAVED:-Y}" != "N" ]; then
      SIGNER_PK=$(jq -r '.[0].private_key' "$saved")
    fi
  fi
  if [ -z "$SIGNER_PK" ]; then
    printf "Paste the signing private key (input hidden): "
    read -rs SIGNER_PK
    echo
  fi
  SIGNER_ADDR=$(cast wallet address "$SIGNER_PK" 2>/dev/null) || {
    err "That does not look like a valid private key."; SIGNER_PK=""; exit 1
  }
  local bal
  bal=$(cast balance "$SIGNER_ADDR" --rpc-url "$RPC")
  echo "Signing as $SIGNER_ADDR  (balance: $(fmt_eth "$bal") ETH)"
}

confirm() { # confirm "description"
  echo
  gold "$1"
  printf "Proceed? [y/N] "
  read -r OK
  [ "${OK:-N}" = "y" ] || [ "${OK:-N}" = "Y" ]
}

send_tx() { # send_tx <to> <sig> [args…]
  local out
  out=$(cast send "$@" --rpc-url "$RPC" --private-key "$SIGNER_PK" --json 2>&1) || {
    err "Transaction failed:"; echo "$out" | /usr/bin/tail -3; return 1
  }
  local hash
  hash=$(echo "$out" | jq -r '.transactionHash // empty')
  echo "✓ mined: $hash"
  [ -n "$EXPLORER" ] && dim "  $EXPLORER/tx/$hash"
}

all_hoards() {
  local n i
  n=$(cast call "$FACTORY" "allHoardsLength()(uint256)" --rpc-url "$RPC" | cut -d' ' -f1)
  for i in $(seq 0 $((n-1))); do
    cast call "$FACTORY" "allHoards(uint256)(address)" "$i" --rpc-url "$RPC"
  done
}

hoard_label() { # pair address → SYMBOL·SYMBOL
  local p=$1 t0 t1 s0 s1
  t0=$(cast call "$p" "token0()(address)" --rpc-url "$RPC")
  t1=$(cast call "$p" "token1()(address)" --rpc-url "$RPC")
  s0=$(cast call "$t0" "symbol()(string)" --rpc-url "$RPC" | tr -d '"')
  s1=$(cast call "$t1" "symbol()(string)" --rpc-url "$RPC" | tr -d '"')
  echo "$s0·$s1"
}

# ── actions ──────────────────────────────────────────────────────
do_status() {
  [ -z "$SPLITTER" ] && { err "No splitter on this chain."; return; }
  local treasury bps
  treasury=$(cast call "$SPLITTER" "treasury()(address)" --rpc-url "$RPC")
  bps=$(cast call "$SPLITTER" "merryMenBps()(uint256)" --rpc-url "$RPC" | cut -d' ' -f1)
  bold "Splitter $SPLITTER"
  echo "  guild treasury: $treasury"
  echo "  split: $((10000 - bps)) bps guild / $bps bps Share"
  echo
  bold "Per-hoard balances (LP tokens)"
  printf "  %-12s %-14s %-14s %-14s\n" "HOARD" "IN SPLITTER" "IN SHARE" "IN TREASURY"
  for p in $(all_hoards); do
    local label sp sh tr
    label=$(hoard_label "$p")
    sp=$(cast call "$p" "balanceOf(address)(uint256)" "$SPLITTER" --rpc-url "$RPC" | cut -d' ' -f1)
    sh=$(cast call "$p" "balanceOf(address)(uint256)" "$SHARE" --rpc-url "$RPC" | cut -d' ' -f1)
    tr=$(cast call "$p" "balanceOf(address)(uint256)" "$treasury" --rpc-url "$RPC" | cut -d' ' -f1)
    printf "  %-12s %-14s %-14s %-14s\n" "$label" \
      "$(fmt_eth "$sp")" "$(fmt_eth "$sh")" "$(fmt_eth "$tr")"
  done
}

do_split() {
  [ -z "$SPLITTER" ] && { err "No splitter on this chain."; return; }
  local pairs=""
  for p in $(all_hoards); do pairs="$pairs${pairs:+,}$p"; done
  get_signer
  confirm "Run split() across all hoards → ½ to the Share, ½ to the guild treasury." || return
  send_tx "$SPLITTER" "split(address[])" "[$pairs]"
}

do_rotate() {
  [ -z "$SPLITTER" ] && { err "No splitter on this chain."; return; }
  local current
  current=$(cast call "$SPLITTER" "treasury()(address)" --rpc-url "$RPC")
  echo "Current guild treasury: $current"
  dim "(the signing key must control that address)"
  printf "New treasury address: "
  read -r NEW_T
  if ! cast to-checksum-address "$NEW_T" > /dev/null 2>&1; then
    err "Not a valid address."; return
  fi
  get_signer
  if [ "$(echo "$SIGNER_ADDR" | tr '[:upper:]' '[:lower:]')" != "$(echo "$current" | tr '[:upper:]' '[:lower:]')" ]; then
    err "Signer $SIGNER_ADDR is not the current treasury — the tx would revert."
    return
  fi
  confirm "Rotate guild treasury: $current → $NEW_T (only the new address can rotate afterwards)." || return
  send_tx "$SPLITTER" "setTreasury(address)" "$NEW_T"
}

do_redeem() {
  get_signer
  bold "Your LP positions:"
  local i=0 pairs=()
  for p in $(all_hoards); do
    local bal label
    bal=$(cast call "$p" "balanceOf(address)(uint256)" "$SIGNER_ADDR" --rpc-url "$RPC" | cut -d' ' -f1)
    if [ "$bal" != "0" ]; then
      i=$((i+1)); pairs+=("$p:$bal")
      label=$(hoard_label "$p")
      echo "  $i) $label — $(fmt_eth "$bal") LP  ($p)"
    fi
  done
  [ "$i" -eq 0 ] && { echo "  none — nothing to redeem"; return; }
  printf "Which position? [1-%d] " "$i"
  read -r CHOICE
  local sel="${pairs[$((CHOICE-1))]}"
  local pair="${sel%%:*}" bal="${sel##*:}"
  printf "Redeem what percent? [100] "
  read -r PCT
  PCT="${PCT:-100}"
  local liq t0 t1
  liq=$(python3 -c "print($bal * $PCT // 100)")
  t0=$(cast call "$pair" "token0()(address)" --rpc-url "$RPC")
  t1=$(cast call "$pair" "token1()(address)" --rpc-url "$RPC")

  local allowance
  allowance=$(cast call "$pair" "allowance(address,address)(uint256)" "$SIGNER_ADDR" "$ROUTER" --rpc-url "$RPC" | cut -d' ' -f1)
  if python3 -c "exit(0 if $allowance < $liq else 1)"; then
    confirm "Step 1/2 — approve the router to spend your LP tokens." || return
    send_tx "$pair" "approve(address,uint256)" "$ROUTER" "$liq" || return
  fi
  confirm "Step 2/2 — remove $PCT% of your $(hoard_label "$pair") liquidity to $SIGNER_ADDR." || return
  send_tx "$ROUTER" \
    "removeLiquidity(address,address,uint256,uint256,uint256,address,uint256)" \
    "$t0" "$t1" "$liq" 0 0 "$SIGNER_ADDR" "$DEADLINE"
}

# ── menu loop ────────────────────────────────────────────────────
while true; do
  echo
  bold "What would you like to do?"
  echo "  1) Status — splitter, chest, treasury balances (read-only)"
  echo "  2) Split the spoils — forward accrued fees (½ Share / ½ guild)"
  echo "  3) Rotate the guild treasury address"
  echo "  4) Redeem my LP tokens for underlying coins"
  echo "  5) Quit"
  printf "> "
  read -r ACTION
  case "${ACTION:-5}" in
    1) do_status ;;
    2) do_split ;;
    3) do_rotate ;;
    4) do_redeem ;;
    5) echo "Fare thee well."; exit 0 ;;
    *) err "Pick 1-5." ;;
  esac
done
