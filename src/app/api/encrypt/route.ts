import { requireSession } from "@/lib/session";
import { NextResponse } from "next/server";
import { encrypt } from "@/lib/encryption";

export async function POST(request: Request) {
  const denied = requireSession(request);
  if (denied) return denied;

  try {
    const { data } = await request.json();
    const encryptedData = encrypt(
      JSON.stringify(data),
      process.env.ENCRYPTION_KEY!
    );
    return NextResponse.json({ encryptedData });
  } catch {
    return NextResponse.json(
      { error: "Encryption error." },
      { status: 500 }
    );
  }
}
