#!/bin/bash
# Prescio On-Chain Metrics Monitor
# Usage: ./onchain-monitor.sh

RPC="https://rpc.monad.xyz"
MARKET="0x6ba44357D3A1693aFe72ABa204b01fb8F8B36F6C"
VAULT="0xbCAad29d9a2Dd64a8b8F1B9fD2e1C59D2b6a3E43"
STAKING="0xB835F850E26809Ac18032dA45c207bB8859481a7"
AUTOBET="0xEd96846b9Df01294404E52eA6A646ED96aC6791C"
TOKEN="0xffC86Ab0C36B0728BbF52164f6319762DA867777"
TREASURY="0x0094f42BF79B7ACC942624A9173fa0ED7554d300"
SERVER="0x001436d283c6ec27f555c25dd045a6a57b5a4be2"

TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S %Z")
DATE=$(date +"%Y-%m-%d")

# Get balances in ether
get_balance() {
    local addr=$1
    local wei=$(cast balance $addr --rpc-url $RPC 2>/dev/null)
    echo "scale=4; $wei / 1000000000000000000" | bc 2>/dev/null || echo "0"
}

# Get transaction count
get_tx_count() {
    local addr=$1
    cast nonce $addr --rpc-url $RPC 2>/dev/null || echo "0"
}

echo "Fetching on-chain data..."

# Balances
MARKET_BAL=$(get_balance $MARKET)
VAULT_BAL=$(get_balance $VAULT)
STAKING_BAL=$(get_balance $STAKING)
AUTOBET_BAL=$(get_balance $AUTOBET)
TREASURY_BAL=$(get_balance $TREASURY)
SERVER_BAL=$(get_balance $SERVER)

# Transaction counts
SERVER_TX=$(get_tx_count $SERVER)

# Output JSON
cat << EOF
{
  "timestamp": "$TIMESTAMP",
  "date": "$DATE",
  "balances": {
    "market": $MARKET_BAL,
    "vault": $VAULT_BAL,
    "staking": $STAKING_BAL,
    "autobet": $AUTOBET_BAL,
    "treasury": $TREASURY_BAL,
    "server": $SERVER_BAL
  },
  "transactions": {
    "server_nonce": $SERVER_TX
  },
  "totals": {
    "tvl": $(echo "$MARKET_BAL + $VAULT_BAL + $STAKING_BAL" | bc)
  }
}
EOF
