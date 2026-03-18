import { NextResponse } from "next/server";
import { createVaultPassword, listVaultPasswords } from "@/lib/vault";
import { validatePasswordInput } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const validation = validatePasswordInput(body);

    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const created = await createVaultPassword(validation.data);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error(
      "Error creating password in Vault:",
      error instanceof Error ? error.message : String(error),
    );
    return NextResponse.json(
      { error: "Wystąpił błąd podczas zapisywania wpisu w Vault" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const passwords = await listVaultPasswords();
    return NextResponse.json(passwords ?? []);
  } catch (error) {
    console.error(
      "Error fetching passwords from Vault:",
      error instanceof Error ? error.message : String(error),
    );
    return NextResponse.json(
      { error: "Wystąpił błąd podczas pobierania wpisów z Vault" },
      { status: 500 },
    );
  }
}
