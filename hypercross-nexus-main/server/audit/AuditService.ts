/**
 * AuditService — durable audit trail for security/subscription/trading events.
 * Never pass secrets/tokens/passwords in `metadata`.
 */

import { getDb } from "../db/postgres";
import { auditLog } from "../../database/schema";

export type AuditAction =
  | "login_success"
  | "login_failure"
  | "register_success"
  | "logout"
  | "session_refreshed"
  | "password_reset_complete"
  | "subscription_changed"
  | "exchange_linked"
  | "trade_requested"
  | "trade_rejected"
  | "trade_executed"
  | "risk_check_failed"
  | "chainstack_connection_changed";

export async function recordAuditEvent(input: {
  userId?: string | null;
  action: AuditAction;
  metadata?: Record<string, unknown>;
  requestId?: string;
}): Promise<void> {
  try {
    const db = getDb();
    await db.insert(auditLog).values({
      userId: input.userId ?? null,
      action: input.action,
      metadata: input.metadata ?? {},
      requestId: input.requestId ?? null,
    });
  } catch (error) {
    // Auditing must never crash the primary request path.
    // drizzle-orm wraps the real driver error in `.cause`; the top-level message is just the query text.
    const cause = (error as { cause?: unknown })?.cause;
    const reason = cause instanceof Error ? cause.message : (error as Error)?.message;
    console.error("Failed to record audit event:", input.action, reason);
  }
}
