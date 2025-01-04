-- CreateTable
CREATE TABLE "passwords" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "url" TEXT,
    "notes" TEXT,
    "twoFactorCode" TEXT,
    "key" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "passwords_pkey" PRIMARY KEY ("id")
);
