import { NextResponse } from "next/server";
import {
  createVaultPassword,
  deleteVaultPassword,
  listVaultPasswords,
  PasswordInput,
} from "@/lib/vault";

export async function POST(request: Request) {
  try {
    const { passwords } = await request.json();

    if (!Array.isArray(passwords) || passwords.length === 0) {
      return NextResponse.json(
        { error: "Nieprawidłowy format danych importu" },
        { status: 400 },
      );
    }

    if (passwords.length > 10_000) {
      return NextResponse.json(
        { error: "Zbyt wiele wpisów w pliku importu (maksimum 10 000)." },
        { status: 413 },
      );
    }

    // 1. Zapisz stare ID przed operacją (atomowość: najpierw dodaj nowe, potem usuń stare)
    const existing = await listVaultPasswords();
    const oldIds = existing.map((p) => p.id);

    // 2. Dodaj nowe wpisy do Vaulta
    for (const pass of passwords) {
      const payload: PasswordInput = {
        title: String(pass.title || ""),
        username: String(pass.username || ""),
        password: String(pass.password || ""),
        key: pass.key ? String(pass.key) : undefined,
        url: pass.url ? String(pass.url) : undefined,
        notes: pass.notes ? String(pass.notes) : undefined,
        twoFactorCode: pass.twoFactorCode ? String(pass.twoFactorCode) : undefined,
      };
      await createVaultPassword(payload);
    }

    // 3. Dopiero teraz usuń stare – nowe są już bezpiecznie zapisane
    await Promise.all(oldIds.map((id) => deleteVaultPassword(id)));

    return NextResponse.json({
      message: "Import zakończony sukcesem",
      imported: passwords.length,
    });
  } catch (error) {
    console.error("Error importing passwords:", error);
    return NextResponse.json(
      { error: "Wystąpił błąd podczas importu haseł" },
      { status: 500 },
    );
  }
}
