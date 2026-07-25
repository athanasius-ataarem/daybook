-- CreateEnum
CREATE TYPE "EntryKind" AS ENUM ('SALE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('CASH', 'MOMO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "kind" "EntryKind" NOT NULL,
    "channel" "Channel" NOT NULL,
    "amountPesewas" INTEGER NOT NULL,
    "note" VARCHAR(200),
    "createdAtDevice" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidReason" VARCHAR(200),

    CONSTRAINT "Entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayClose" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "openingCashPesewas" INTEGER NOT NULL,
    "openingMomoPesewas" INTEGER NOT NULL,
    "expectedCashPesewas" INTEGER NOT NULL,
    "expectedMomoPesewas" INTEGER NOT NULL,
    "countedCashPesewas" INTEGER NOT NULL,
    "countedMomoPesewas" INTEGER NOT NULL,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayClose_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "Entry_userId_businessDate_idx" ON "Entry"("userId", "businessDate");

-- CreateIndex
CREATE INDEX "Entry_userId_updatedAt_idx" ON "Entry"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "DayClose_userId_updatedAt_idx" ON "DayClose"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DayClose_userId_businessDate_key" ON "DayClose"("userId", "businessDate");

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayClose" ADD CONSTRAINT "DayClose_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
