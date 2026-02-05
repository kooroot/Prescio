import { useState, useMemo, useEffect } from "react";
import { useAccount, useConnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { MONAD_TESTNET_CHAIN_ID, MONAD_TESTNET_RPC } from "@prescio/common";
import { formatEther, parseEther } from "viem";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wallet, Lock, Trophy } from "lucide-react";
import { Phase } from "@prescio/common";
import type { Player } from "@prescio/common";
import { useMarketInfo, useOnChainUserBet, ContractMarketState } from "@/hooks/useContract";
import { useOdds, usePlaceBet, useUserBets } from "@/hooks/useBetting";
import { OddsDisplay } from "./OddsDisplay";
import { BetHistory } from "./BetHistory";
import { ClaimButton } from "./ClaimButton";

interface BetPanelProps {
  gameId: string;
  players: Player[];
  phase: Phase;
}

const MIN_BET = "0.1";
const BET_STEP = "0.1";

function marketStateLabel(state: ContractMarketState) {
  switch (state) {
    case ContractMarketState.OPEN:
      return { text: "Betting Open", color: "bg-green-500/20 text-green-400 border-green-500/30" };
    case ContractMarketState.CLOSED:
      return { text: "Betting Closed", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" };
    case ContractMarketState.RESOLVED:
      return { text: "Resolved", color: "bg-monad-purple/20 text-monad-purple border-monad-purple/30" };
    default:
      return { text: "No Market", color: "bg-gray-500/20 text-gray-400 border-gray-500/30" };
  }
}

export function BetPanel({ gameId, players, phase }: BetPanelProps) {
  const { address, isConnected, chainId } = useAccount();
  const { connect } = useConnect();
  const isWrongChain = isConnected && chainId !== MONAD_TESTNET_CHAIN_ID;

  const switchToMonad = async () => {
    const provider = (window as any).ethereum;
    if (!provider) return;
    const chainIdHex = `0x${MONAD_TESTNET_CHAIN_ID.toString(16)}`;
    const chainParams = {
      chainId: chainIdHex,
      chainName: "Monad Testnet",
      nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
      rpcUrls: [MONAD_TESTNET_RPC],
      blockExplorerUrls: ["https://testnet.monadexplorer.com"],
    };
    try {
      // Try removing old chain config first (resets RPC)
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x1" }] });
      try {
        await provider.request({ method: "wallet_removeEthereumChain", params: [{ chainId: chainIdHex }] });
      } catch (_) { /* ignore if not supported */ }
      await provider.request({ method: "wallet_addEthereumChain", params: [chainParams] });
    } catch (err: any) {
      // Fallback: just try add (which switches if exists)
      try {
        await provider.request({ method: "wallet_addEthereumChain", params: [chainParams] });
      } catch (_) {
        await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainIdHex }] });
      }
    }
  };
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [betAmount, setBetAmount] = useState(MIN_BET);

  // Contract reads
  const { marketInfo } = useMarketInfo(gameId);
  const { userBet } = useOnChainUserBet(gameId, address);

  // API reads
  const { oddsMap, bettingEnabled, totalPool: wsTotalPool } = useOdds(gameId);
  const { bets } = useUserBets(gameId, address);
  const { placeBet, isPending, isConfirming, isSuccess, error, reset } = usePlaceBet();

  // Derived state
  const hasMarket = marketInfo != null && marketInfo.playerCount > 0;
  const marketState = hasMarket ? marketInfo.state : null;
  // Ensure totalPool is BigInt (in case of type mismatch from contract)
  const rawPool = marketInfo?.totalPool;
  const totalPool = typeof rawPool === 'bigint' ? rawPool : (rawPool ? BigInt(rawPool) : 0n);
  // Get outcome totals from odds API (oddsMap contains totalStaked per player)
  const odds = oddsMap[gameId] ?? [];
  const outcomeTotals = odds.map((o) => o.totalStaked);
  // V1: Use server-side bettingEnabled flag (on-chain state can't reopen after VOTE)
  // On-chain state only matters for RESOLVED (final payout)
  const isOpen = hasMarket && bettingEnabled;
  const isResolved = hasMarket && marketState === ContractMarketState.RESOLVED;
  const isPaused = hasMarket && !bettingEnabled && !isResolved;
  
  // State label with PAUSED support
  const getStateLabel = () => {
    if (!hasMarket) return { text: "No Market", color: "bg-gray-500/20 text-gray-400 border-gray-500/30" };
    if (isPaused) return { text: "Betting Paused", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" };
    return marketStateLabel(marketState!);
  };
  const stateLabel = getStateLabel();

  // Reset on success
  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => {
        reset();
        setSelectedIndex(null);
        setBetAmount(MIN_BET);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, reset]);

  // Estimated payout
  const estimatedPayout = useMemo(() => {
    if (selectedIndex === null || !betAmount) return null;
    const betWei = parseEther(betAmount);
    const currentOutcome = (selectedIndex < outcomeTotals.length ? outcomeTotals[selectedIndex] : undefined) ?? 0n;
    const newOutcome = currentOutcome + betWei;
    const safePool = totalPool ?? 0n;
    const newTotal = safePool + betWei;
    if (newOutcome === 0n) return null;
    // Payout = (myBet / winnerPool) * totalPool * (1 - fee)
    // Approximate with 5% fee
    const payout = (betWei * newTotal * 95n) / (newOutcome * 100n);
    return payout;
  }, [selectedIndex, betAmount, outcomeTotals, totalPool]);

  const canBet = isOpen && isConnected && !isWrongChain && selectedIndex !== null && parseFloat(betAmount) >= 0.1;

  const handlePlaceBet = () => {
    if (!canBet || selectedIndex === null) return;
    placeBet(gameId, selectedIndex, betAmount);
  };

  // Alive players for betting
  const alivePlayers = players.filter((p) => p.isAlive);

  return (
    <Card className="border-monad-border bg-monad-card/40">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm text-gray-400 uppercase tracking-wider flex items-center gap-2">
            🎰 Betting
          </CardTitle>
          <Badge className={`${stateLabel.color} text-[10px]`} variant="outline">
            {stateLabel.text}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* ─── No Market Yet ─── */}
        {!hasMarket && (
          <div className="text-center py-4">
            <span className="text-2xl">🎰</span>
            <p className="mt-2 text-sm text-gray-500">
              Market not created yet
            </p>
          </div>
        )}

        {/* ─── Odds Display ─── */}
        {hasMarket && (
          <OddsDisplay
            players={players}
            outcomeTotals={outcomeTotals}
            totalPool={totalPool}
            selectedIndex={selectedIndex}
            onSelectPlayer={(idx) => {
              if (isOpen) setSelectedIndex(idx === selectedIndex ? null : idx);
            }}
          />
        )}

        {/* ─── Betting Paused (NIGHT phase) ─── */}
        {isPaused && (
          <div className="flex items-center justify-center gap-2 rounded-lg bg-orange-500/5 border border-orange-500/10 px-4 py-3">
            <Lock className="h-4 w-4 text-orange-500/50" />
            <span className="text-sm text-orange-500/70">Betting opens at Report phase</span>
          </div>
        )}

        {/* ─── Betting Closed ─── */}
        {marketState === ContractMarketState.CLOSED && (
          <div className="flex items-center justify-center gap-2 rounded-lg bg-yellow-500/5 border border-yellow-500/10 px-4 py-3">
            <Lock className="h-4 w-4 text-yellow-500/50" />
            <span className="text-sm text-yellow-500/70">Betting is closed</span>
          </div>
        )}

        {/* ─── Resolved: Claim ─── */}
        {isResolved && marketInfo && userBet && (
          <ClaimButton
            gameId={gameId}
            marketState={marketState}
            userBetAmount={userBet.amount}
            userSuspectIndex={userBet.suspectIndex}
            resolvedImpostorIndex={marketInfo.impostorIndex}
            hasClaimed={userBet.claimed}
            totalPool={totalPool}
            outcomeTotals={outcomeTotals}
            isConnected={isConnected}
          />
        )}

        {/* ─── Bet Input (only when OPEN) ─── */}
        {isOpen && (
          <>
            {!isConnected ? (
              <Button
                onClick={() => connect({ connector: injected() })}
                className="w-full bg-monad-purple hover:bg-monad-purple/80"
              >
                <Wallet className="mr-2 h-4 w-4" />
                Connect Wallet to Bet
              </Button>
            ) : isWrongChain ? (
              <Button
                onClick={switchToMonad}
                className="w-full bg-yellow-600 hover:bg-yellow-700"
              >
                ⚠️ Switch to Monad Testnet
              </Button>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Selected player */}
                {selectedIndex !== null && (
                  <div className="text-xs text-gray-400 text-center">
                    Betting on{" "}
                    <span className="text-monad-purple font-medium">
                      {players[selectedIndex]?.nickname ?? `#${selectedIndex}`}
                    </span>{" "}
                    as impostor
                  </div>
                )}

                {/* Amount input */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type="number"
                      min={MIN_BET}
                      step={BET_STEP}
                      value={betAmount}
                      onChange={(e) => setBetAmount(e.target.value)}
                      className="pr-12 bg-monad-card/50 border-monad-border text-gray-200"
                      placeholder="0.1"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                      MON
                    </span>
                  </div>
                  <Button
                    onClick={handlePlaceBet}
                    disabled={!canBet || isPending || isConfirming}
                    className="bg-monad-purple hover:bg-monad-purple/80 min-w-[100px]"
                  >
                    {isPending || isConfirming ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isSuccess ? (
                      "✓ Placed!"
                    ) : (
                      "Place Bet"
                    )}
                  </Button>
                </div>

                {/* Estimated payout */}
                {estimatedPayout !== null && selectedIndex !== null && (
                  <div className="flex items-center justify-between rounded-lg bg-gray-800/30 px-3 py-2">
                    <span className="text-xs text-gray-500">Est. payout</span>
                    <span className="text-sm font-mono font-bold text-alive">
                      {parseFloat(formatEther(estimatedPayout)).toFixed(3)} MON
                    </span>
                  </div>
                )}

                {/* Tx pending */}
                {(isPending || isConfirming) && (
                  <div className="text-center text-xs text-gray-500">
                    {isPending ? "Confirm in your wallet…" : "Waiting for confirmation…"}
                  </div>
                )}

                {/* Error */}
                {error && (
                  <p className="text-xs text-red-400 text-center">
                    {(error as Error).message?.slice(0, 100)}
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {/* ─── Bet History ─── */}
        <BetHistory bets={bets} players={players} isConnected={isConnected} />
      </CardContent>
    </Card>
  );
}
