/**
 * Statistics API Routes
 *
 * Endpoints:
 * - GET /api/stats/summary - Overall statistics summary
 * - GET /api/stats/leaderboard - Leaderboard by metric
 * - GET /api/stats/agent/:name - Agent detail (Phase 2)
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import { asyncHandler } from "./middleware.js";
import { loadFinishedGames } from "../game/persistence.js";
import {
  getCachedLeaderboard,
  getCachedSummary,
  getCachedAgentDetail,
  isValidMetric,
  isValidPeriod,
  isValidAgentName,
  parseLimit,
  type LeaderboardMetric,
  type StatsPeriod,
  type StatsErrorCode,
} from "../stats/index.js";

// ============================================
// Feature Flag
// ============================================

const STATS_API_ENABLED = process.env.STATS_API_ENABLED !== "false";

// ============================================
// Rate Limiting (simple in-memory implementation)
// ============================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute

function getRateLimitKey(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

function checkRateLimit(req: Request): boolean {
  const key = getRateLimitKey(req);
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  entry.count++;
  return true;
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (entry.resetAt < now) {
      rateLimitMap.delete(key);
    }
  }
}, RATE_LIMIT_WINDOW_MS);

// ============================================
// Error Response Helper
// ============================================

function errorResponse(code: StatsErrorCode, message: string) {
  return { error: { code, message } };
}

// ============================================
// Middleware
// ============================================

function statsRateLimiter(req: Request, res: Response, next: NextFunction) {
  if (!checkRateLimit(req)) {
    res.status(429).json(errorResponse("RATE_LIMIT_EXCEEDED", "Too many requests. Please try again later."));
    return;
  }
  next();
}

function statsFeatureCheck(_req: Request, res: Response, next: NextFunction) {
  if (!STATS_API_ENABLED) {
    res.status(503).json(errorResponse("SERVICE_DISABLED", "Statistics API is currently disabled."));
    return;
  }
  next();
}

// ============================================
// Router
// ============================================

export const statsRouter: Router = Router();

// Apply middleware to all routes
statsRouter.use(statsFeatureCheck);
statsRouter.use(statsRateLimiter);

// ------------------------------------------
// GET /api/stats/summary — Overall statistics
// ------------------------------------------
statsRouter.get(
  "/summary",
  asyncHandler(async (_req, res) => {
    try {
      const games = loadFinishedGames();
      const summary = getCachedSummary(games);
      res.json(summary);
    } catch (err) {
      console.error("[Stats] Error generating summary:", err);
      res.status(500).json(errorResponse("INTERNAL_ERROR", "Failed to generate statistics."));
    }
  })
);

// ------------------------------------------
// GET /api/stats/leaderboard — Leaderboard by metric
// ------------------------------------------
statsRouter.get(
  "/leaderboard",
  asyncHandler(async (req, res) => {
    try {
      // Parse and validate parameters
      const metricParam = String(req.query.metric ?? "wins");
      const periodParam = String(req.query.period ?? "all");
      const limit = parseLimit(req.query.limit, 10, 50);

      // Validate metric
      if (!isValidMetric(metricParam)) {
        res.status(400).json(errorResponse(
          "INVALID_METRIC",
          "Invalid metric. Valid values: wins, kills, survival, kd"
        ));
        return;
      }

      // Validate period
      if (!isValidPeriod(periodParam)) {
        res.status(400).json(errorResponse(
          "INVALID_PERIOD",
          "Invalid period. Valid values: all, daily, weekly"
        ));
        return;
      }

      const metric = metricParam as LeaderboardMetric;
      const period = periodParam as StatsPeriod;

      const games = loadFinishedGames();
      const leaderboard = getCachedLeaderboard(games, metric, period, limit);

      res.json(leaderboard);
    } catch (err) {
      console.error("[Stats] Error generating leaderboard:", err);
      res.status(500).json(errorResponse("INTERNAL_ERROR", "Failed to generate leaderboard."));
    }
  })
);

// ------------------------------------------
// GET /api/stats/agent/:name — Agent detail (Phase 2)
// ------------------------------------------
statsRouter.get(
  "/agent/:name",
  asyncHandler(async (req, res) => {
    try {
      const name = String(req.params.name);

      // Validate agent name (whitelist check for path traversal prevention)
      if (!isValidAgentName(name)) {
        res.status(400).json(errorResponse(
          "INVALID_AGENT_NAME",
          "Invalid agent name. Agent not found in the system."
        ));
        return;
      }

      const games = loadFinishedGames();
      const agentDetail = getCachedAgentDetail(games, name);

      if (!agentDetail) {
        res.status(404).json(errorResponse(
          "AGENT_NOT_FOUND",
          `No game history found for agent: ${name}`
        ));
        return;
      }

      res.json(agentDetail);
    } catch (err) {
      console.error("[Stats] Error getting agent detail:", err);
      res.status(500).json(errorResponse("INTERNAL_ERROR", "Failed to get agent statistics."));
    }
  })
);
