/**
 * Safe API error response helper.
 *
 * Wraps `res.status(...).json(...)` so routes never accidentally leak
 * raw `error.message` strings (which on Postgres / axios / ORM errors
 * frequently include DB hostnames, connection strings, internal paths
 * or stack fragments) to callers in production.
 *
 * Usage:
 *   } catch (err) {
 *     return safeError(res, err, {
 *       status: 500,
 *       publicMessage: "Failed to load holder data",
 *       context: "microstructure.fetchHolders",
 *     });
 *   }
 *
 * - `publicMessage` is what ships to the client. Keep it generic.
 * - `context` is what gets logged server-side alongside the raw error.
 *   Shows up in stdout / your log aggregator, never in the HTTP body.
 * - In DEV (`NODE_ENV !== 'production'`) we DO include the raw message
 *   in the response under `.detail` so local debugging is still easy.
 */

import type { NextApiResponse } from "next";

interface SafeErrorOpts {
  status?: number;
  /** Generic message sent to the client. Default: "Internal server error" */
  publicMessage?: string;
  /** Short label for the log line. Default: "api" */
  context?: string;
}

/**
 * Write a safe JSON error response. Logs the raw error server-side.
 * Returns void so callers can `return safeError(...)`.
 */
export function safeError(
  res: NextApiResponse,
  err: unknown,
  opts: SafeErrorOpts = {},
): void {
  const status = opts.status ?? 500;
  const publicMessage = opts.publicMessage ?? "Internal server error";
  const context = opts.context ?? "api";

  // Always log the raw error server-side so operators can debug.
  const rawMessage = err instanceof Error ? err.message : String(err);
  console.error(`[${context}] ${rawMessage}`, err);

  // In development, include the raw message to keep local debugging sane.
  // In production, never return the raw message to the client.
  const isDev = process.env.NODE_ENV !== "production";
  const body: Record<string, unknown> = {
    success: false,
    error: publicMessage,
  };
  if (isDev) {
    body.detail = rawMessage;
  }

  res.status(status).json(body);
}
