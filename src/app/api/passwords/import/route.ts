import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";

export async function POST(request: Request) {
  try {
    const { passwords } = await request.json();

    // Usuń wszystkie istniejące hasła
    await prisma.password.deleteMany();

    // Dodaj nowe hasła
    for (const pass of passwords) {
      await prisma.password.create({
        data: {
          title: pass.title,
          username: pass.username,
          password: encrypt(pass.password, process.env.ENCRYPTION_KEY!),
          key: pass.key ? encrypt(pass.key, process.env.ENCRYPTION_KEY!) : null,
          url: pass.url,
          notes: pass.notes,
          twoFactorCode: pass.twoFactorCode,
        },
      });
    }

    return NextResponse.json({ message: "Import zakończony sukcesem" });
  } catch (error) {
    console.error("Error importing passwords:", error);
    return NextResponse.json(
      { error: "Wystąpił błąd podczas importu haseł" },
      { status: 500 }
    );
  }
}
