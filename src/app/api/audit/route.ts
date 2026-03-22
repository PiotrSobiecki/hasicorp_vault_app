import { NextResponse } from "next/server";
import { getAuditLog } from "@/lib/auditLog";

export async function GET() {
  return NextResponse.json(getAuditLog());
}
