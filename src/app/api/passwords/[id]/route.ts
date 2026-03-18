import { NextResponse } from "next/server";
import {
  deleteVaultPassword,
  getVaultPassword,
  updateVaultPassword,
} from "@/lib/vault";
import { validatePasswordInput } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    await deleteVaultPassword(id);
    return NextResponse.json({ message: "Wpis usunięty z Vault" });
  } catch (error) {
    console.error(
      "Error deleting password from Vault:",
      error instanceof Error ? error.message : String(error),
    );
    return NextResponse.json(
      { error: "Wystąpił błąd podczas usuwania wpisu z Vault" },
      { status: 500 },
    );
  }
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const password = await getVaultPassword(id);

    if (!password) {
      return NextResponse.json(
        { error: "Wpis nie został znaleziony w Vault" },
        { status: 404 },
      );
    }

    return NextResponse.json(password);
  } catch (error) {
    console.error(
      "Error fetching password from Vault:",
      error instanceof Error ? error.message : String(error),
    );
    return NextResponse.json(
      { error: "Wystąpił błąd podczas pobierania wpisu z Vault" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const validation = validatePasswordInput(body);

    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const updated = await updateVaultPassword(id, validation.data);
    return NextResponse.json(updated);
  } catch (error) {
    console.error(
      "Error updating password in Vault:",
      error instanceof Error ? error.message : String(error),
    );
    return NextResponse.json(
      { error: "Wystąpił błąd podczas aktualizacji wpisu w Vault" },
      { status: 500 },
    );
  }
}
