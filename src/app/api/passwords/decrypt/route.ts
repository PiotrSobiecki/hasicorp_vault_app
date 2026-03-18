import { NextResponse } from "next/server";
import { decrypt } from "@/lib/encryption";

export async function POST(request: Request) {
  try {
    const { encryptedData } = await request.json();

    if (!encryptedData || typeof encryptedData !== "string") {
      return NextResponse.json(
        { error: "Brak danych do odszyfrowania" },
        { status: 400 },
      );
    }

    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "Serwer nie jest prawidłowo skonfigurowany." },
        { status: 500 },
      );
    }

    const decryptedJson = decrypt(encryptedData, key);
    const data = JSON.parse(decryptedJson);

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json(
      { error: "Nie udało się odszyfrować pliku. Sprawdź czy plik jest poprawny." },
      { status: 400 },
    );
  }
}
