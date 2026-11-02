import { requireSession } from "@/lib/session";
import { NextResponse } from "next/server";
import { getAuditLog } from "@/lib/auditLog";

export async function GET(request: Request) {
  const denied = requireSession(request);
  if (denied) return denied;

  return NextResponse.json(getAuditLog());
}
