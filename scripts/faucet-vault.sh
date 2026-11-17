#!/usr/bin/env bash
# Sozu Faucet vault ops.
#
# Usage:
#   ./scripts/faucet-vault.sh treasury         # treasury G address + balances
#   ./scripts/faucet-vault.sh balance          # vault USDC balance + default claim amount
#   ./scripts/faucet-vault.sh fund 50          # move 50 USDC from treasury into the vault
#   ./scripts/faucet-vault.sh withdraw 10      # pull 10 USDC back to the treasury
#   ./scripts/faucet-vault.sh set-amount 0.5   # set contract default claim amount
#   ./scripts/faucet-vault.sh audit            # read-only admin, token, balance (no submit)
#
# Reads FAUCET_CONTRACT_ID / FAUCET_TOKEN_CONTRACT_ID / FAUCET_TREASURY_SECRET
# (testnet fallback STELLAR_FUNDER_SECRET) and STELLAR_NETWORK from .env.local.
# Mainnet ops also require FAUCET_MAINNET_PILOT=1 and FAUCET_TREASURY_SECRET.
# Requires the stellar CLI.

set -euo pipefail
cd "$(dirname "$0")/.."

envval() { grep -E "^\s*$1=" .env.local | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs || true; }

CONTRACT_ID="$(envval FAUCET_CONTRACT_ID)"
TOKEN_ID="$(envval FAUCET_TOKEN_CONTRACT_ID)"
NETWORK="$(envval STELLAR_NETWORK)"
PILOT="$(envval FAUCET_MAINNET_PILOT)"
SECRET="$(envval FAUCET_TREASURY_SECRET)"
[ -z "$NETWORK" ] && NETWORK="testnet"

if [ "$NETWORK" = "mainnet" ]; then
  [ "$PILOT" = "1" ] || { echo "Refusing mainnet vault ops without FAUCET_MAINNET_PILOT=1" >&2; exit 1; }
  [ -n "$SECRET" ] || { echo "Mainnet vault ops require FAUCET_TREASURY_SECRET (no funder fallback)" >&2; exit 1; }
else
  NETWORK="testnet"
  [ -z "$SECRET" ] && SECRET="$(envval STELLAR_FUNDER_SECRET)"
fi

[ -z "$CONTRACT_ID" ] && { echo "FAUCET_CONTRACT_ID missing in .env.local" >&2; exit 1; }
[ -z "$SECRET" ] && { echo "FAUCET_TREASURY_SECRET / STELLAR_FUNDER_SECRET missing in .env.local" >&2; exit 1; }

export FAUCET_VAULT_SECRET="$SECRET"
TREASURY_PK="$(node -e "const{Keypair}=require('@stellar/stellar-sdk');console.log(Keypair.fromSecret(process.env.FAUCET_VAULT_SECRET).publicKey())")"
unset FAUCET_VAULT_SECRET

HORIZON="https://horizon-testnet.stellar.org"
[ "$NETWORK" = "mainnet" ] && HORIZON="https://horizon.stellar.org"

to_minor() { python3 -c "import sys; print(int(round(float(sys.argv[1]) * 10**7)))" "$1"; }
from_minor() { python3 -c "import sys; print(int(sys.argv[1]) / 10**7)" "$1"; }

invoke() { stellar contract invoke --id "$CONTRACT_ID" --source-account "$SECRET" --network "$NETWORK" -- "$@"; }
view() { stellar contract invoke --id "$CONTRACT_ID" --source-account "$SECRET" --network "$NETWORK" --send=no -- "$@"; }

case "${1:-}" in
  treasury)
    echo "Treasury G: $TREASURY_PK"
    curl -s "$HORIZON/accounts/$TREASURY_PK" \
      | python3 -c "import json,sys; j=json.load(sys.stdin); [print(' ', (b.get('asset_code') or 'XLM'), b['balance']) for b in j.get('balances', [])]"
    ;;
  balance)
    echo "Vault contract: $CONTRACT_ID"
    echo "USDC balance:        $(from_minor "$(invoke balance 2>/dev/null | tr -d '\"')")"
    echo "Default claim amount: $(from_minor "$(invoke claim_amount 2>/dev/null | tr -d '\"')")"
    ;;
  fund)
    [ -z "${2:-}" ] && { echo "usage: $0 fund <usdc_amount>" >&2; exit 1; }
    [ -z "$TOKEN_ID" ] && { echo "FAUCET_TOKEN_CONTRACT_ID missing in .env.local" >&2; exit 1; }
    MINOR="$(to_minor "$2")"
    echo "Transferring $2 USDC from treasury -> vault…"
    stellar contract invoke --id "$TOKEN_ID" --source-account "$SECRET" --network "$NETWORK" -- \
      transfer --from "$TREASURY_PK" --to "$CONTRACT_ID" --amount "$MINOR"
    "$0" balance
    ;;
  withdraw)
    [ -z "${2:-}" ] && { echo "usage: $0 withdraw <usdc_amount>" >&2; exit 1; }
    MINOR="$(to_minor "$2")"
    invoke withdraw --to "$TREASURY_PK" --amount "$MINOR"
    "$0" balance
    ;;
  audit)
    CIRCLE="CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"
    ADMIN="$(view admin 2>/dev/null | tr -d '"')"
    TOKEN="$(view token 2>/dev/null | tr -d '"')"
    echo "Network:             $NETWORK"
    echo "Vault contract:      $CONTRACT_ID"
    echo "Admin:               $ADMIN"
    echo "Treasury G:          $TREASURY_PK"
    echo "Token:               $TOKEN"
    if [ "$TOKEN" = "$CIRCLE" ]; then
      echo "Token check:         Circle testnet USDC SAC"
    else
      echo "Token check:         NOT the expected Circle testnet USDC SAC ($CIRCLE)"
    fi
    echo "USDC balance:        $(from_minor "$(view balance 2>/dev/null | tr -d '"')")"
    echo "Default claim amount: $(from_minor "$(view claim_amount 2>/dev/null | tr -d '"')")"
    if [ "$ADMIN" = "$TREASURY_PK" ]; then
      echo "Admin check:         treasury key is the contract admin"
    else
      echo "Admin check:         treasury key is NOT the contract admin"
    fi
    ;;
  set-amount)
    [ -z "${2:-}" ] && { echo "usage: $0 set-amount <usdc_amount>" >&2; exit 1; }
    MINOR="$(to_minor "$2")"
    invoke set_claim_amount --claim_amount "$MINOR"
    "$0" balance
    ;;
  *)
    grep '^#   ' "$0" | sed 's/^#   //'
    exit 1
    ;;
esac
