/** Shorten an Ethereum address: 0x1234...abcd */
export function shortenAddress(address: string, chars = 4): string {
  if (!address) return "";
  if (address.length < chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/** Format a MON amount from wei to human-readable */
export function formatMON(wei: bigint, decimals = 4): string {
  const divisor = 10n ** 18n;
  const whole = wei / divisor;
  const fraction = wei % divisor;

  if (fraction === 0n) return `${whole} MON`;

  const fractionStr = fraction.toString().padStart(18, "0").slice(0, decimals);
  // Remove trailing zeros
  const trimmed = fractionStr.replace(/0+$/, "");
  if (!trimmed) return `${whole} MON`;

  return `${whole}.${trimmed} MON`;
}

/** Parse a MON string amount to wei */
export function parseMON(amount: string): bigint {
  const [whole, fraction = ""] = amount.split(".");
  const paddedFraction = fraction.padEnd(18, "0").slice(0, 18);
  return BigInt(whole || "0") * 10n ** 18n + BigInt(paddedFraction);
}

/** Format a number with commas: 1234567 → 1,234,567 */
export function formatNumber(n: number | bigint): string {
  return n.toLocaleString("en-US");
}

/** Format odds as a human-readable string */
export function formatOdds(numerator: number, denominator: number): string {
  if (denominator === 0) return "N/A";
  const decimal = numerator / denominator;
  return `${decimal.toFixed(2)}x`;
}

/** Format implied probability as a percentage */
export function formatProbability(probability: number): string {
  return `${(probability * 100).toFixed(1)}%`;
}

/** Format a timestamp to a relative time string */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 1000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

/** Format seconds to mm:ss countdown */
export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
