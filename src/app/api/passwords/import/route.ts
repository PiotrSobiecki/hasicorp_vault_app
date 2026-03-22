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
        { error: "Invalid import data format." },
        { status: 400 },
      );
    }

    if (passwords.length > 10_000) {
      return NextResponse.json(
        { error: "Too many entries in import file (maximum 10,000)." },
        { status: 413 },
      );
    }

    // 1. Save old IDs before operation (add new first, then delete old — prevents data loss)
    const existing = await listVaultPasswords();
    const oldIds = existing.map((p) => p.id);

    // 2. Add new entries to Vault
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

    // 3. Now delete old ones — new entries are already safely stored
    await Promise.all(oldIds.map((id) => deleteVaultPassword(id)));

    return NextResponse.json({
      message: "Import completed successfully.",
      imported: passwords.length,
    });
  } catch (error) {
    console.error("Error importing passwords:", error);
    return NextResponse.json(
      { error: "Error importing passwords." },
      { status: 500 },
    );
  }
}
