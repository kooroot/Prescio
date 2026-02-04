/**
 * API Middleware — Error handling, logging, CORS
 */
import type { Request, Response, NextFunction, RequestHandler } from "express";
import cors from "cors";

// ============================================
// Async Route Wrapper (try-catch)
// ============================================

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export function asyncHandler(fn: AsyncHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ============================================
// Request Logger
// ============================================

export function requestLogger(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const start = Date.now();
    const { method, originalUrl } = req;

    _res.on("finish", () => {
      const duration = Date.now() - start;
      console.log(
        `[API] ${method} ${originalUrl} → ${_res.statusCode} (${duration}ms)`
      );
    });

    next();
  };
}

// ============================================
// CORS Config
// ============================================

export function corsMiddleware(origins: string | string[]) {
  return cors({
    origin: origins,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });
}

// ============================================
// Error Handler (Express error middleware)
// ============================================

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  const code = err.code ?? "INTERNAL_ERROR";
  const message = err.message ?? "Internal server error";

  console.error(`[API] Error: ${code} — ${message}`);

  res.status(statusCode).json({
    error: {
      code,
      message,
    },
  });
}
