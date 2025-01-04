import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";

type PasswordRecord = {
  id: string;
  title: string;
  username: string;
  password: string;
  key: string | null;
  url: string | null;
  notes: string | null;
  twoFactorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function POST(request: Request) {
  try {
    const { title, username, password, key, url, notes, twoFactorCode } =
      await request.json();
    const encryptedPassword = encrypt(password, process.env.ENCRYPTION_KEY!);
    const encryptedKey = key ? encrypt(key, process.env.ENCRYPTION_KEY!) : null;

    const newPassword = await prisma.$queryRaw<PasswordRecord[]>`
      INSERT INTO "passwords" (
        id, title, username, password, key, url, notes, "twoFactorCode", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), 
        ${String(title)}, 
        ${String(username)}, 
        ${encryptedPassword}, 
        ${encryptedKey},
        ${url ? String(url) : null}, 
        ${notes ? String(notes) : null},
        ${twoFactorCode ? String(twoFactorCode) : null},
        NOW(),
        NOW()
      ) RETURNING *
    `;

    return NextResponse.json(newPassword[0]);
  } catch (error) {
    console.error("Error creating password:", error);
    return NextResponse.json(
      { error: "Wystąpił błąd podczas zapisywania hasła" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const passwords = await prisma.password.findMany();
    const decryptedPasswords = passwords.map((pass) => ({
      ...pass,
      password: decrypt(pass.password, process.env.ENCRYPTION_KEY!),
      key: pass.key ? decrypt(pass.key, process.env.ENCRYPTION_KEY!) : null,
    }));
    return NextResponse.json(decryptedPasswords);
  } catch (error) {
    console.error("Error fetching passwords:", error);
    return NextResponse.json(
      { error: "Wystąpił błąd podczas pobierania haseł" },
      { status: 500 }
    );
  }
}
