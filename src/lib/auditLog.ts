/**
 * In-memory circular audit log — single-instance deployments (Railway).
 * Resets on server restart; holds last MAX_EVENTS entries.
 */

export interface AuditEvent {
  timestamp: string;
  ip: string;
  success: boolean;
}

const MAX_EVENTS = 100;
const events: AuditEvent[] = [];

export function logLoginAttempt(ip: string, success: boolean): void {
  events.unshift({ timestamp: new Date().toISOString(), ip, success });
  if (events.length > MAX_EVENTS) events.pop();
}

export function getAuditLog(): AuditEvent[] {
  return [...events];
}
