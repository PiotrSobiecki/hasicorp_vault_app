import { NextResponse } from "next/server";
import { encrypt } from "@/lib/encryption";

export async function POST(request: Request) {
  try {
    const { data } = await request.json();
    const encryptedData = encrypt(
      JSON.stringify(data),
      process.env.ENCRYPTION_KEY!
    );
    return NextResponse.json({ encryptedData });
  } catch {
    return NextResponse.json(
      { error: "Wystąpił błąd podczas szyfrowania" },
      { status: 500 }
    );
  }
}
