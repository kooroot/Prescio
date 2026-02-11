import { TierLevel } from "@/lib/leaderboard/types";
import { TIER_MAP } from "@/lib/leaderboard/constants";

interface TierBadgeProps {
  tier: TierLevel;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
}

export function TierBadge({ tier, size = "md", showIcon = true }: TierBadgeProps) {
  const tierInfo = TIER_MAP[tier];
  
  if (!tierInfo) {
    return (
      <span className="text-[#71717A] text-xs">No Tier</span>
    );
  }
  
  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-[10px]",
    md: "px-2 py-1 text-xs",
    lg: "px-3 py-1.5 text-sm",
  };
  
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-medium ${tierInfo.badgeClass} ${sizeClasses[size]}`}
    >
      {showIcon && <span>{tierInfo.icon}</span>}
      <span>{tierInfo.name}</span>
    </span>
  );
}
