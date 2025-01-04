import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.password.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: "Hasło zostało usunięte" });
  } catch (error) {
    return NextResponse.json(
      { error: "Wystąpił błąd podczas usuwania hasła" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const password = await prisma.password.findUnique({
      where: { id: params.id },
    });

    if (!password) {
      return NextResponse.json(
        { error: "Hasło nie zostało znalezione" },
        { status: 404 }
      );
    }

    const decryptedPassword = {
      ...password,
      password: decrypt(password.password, process.env.ENCRYPTION_KEY!),
    };

    return NextResponse.json(decryptedPassword);
  } catch (error) {
    console.error("Error fetching password:", error);
    return NextResponse.json(
      { error: "Wystąpił błąd podczas pobierania hasła" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const data = await request.json();
    const updatedPassword = await prisma.password.update({
      where: { id: params.id },
      data: {
        title: data.title,
        username: data.username,
        password: encrypt(data.password, process.env.ENCRYPTION_KEY!),
        url: data.url,
        notes: data.notes,
        twoFactorCode: data.twoFactorCode,
      },
    });

    const decryptedPassword = {
      ...updatedPassword,
      password: decrypt(updatedPassword.password, process.env.ENCRYPTION_KEY!),
    };

    return NextResponse.json(decryptedPassword);
  } catch (error) {
    return NextResponse.json(
      { error: "Wystąpił błąd podczas aktualizacji hasła" },
      { status: 500 }
    );
  }
}
