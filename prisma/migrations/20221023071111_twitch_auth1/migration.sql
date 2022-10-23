/*
  Warnings:

  - Added the required column `lastUpdatedTimestamp` to the `TwitchUser` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "TwitchUser" ADD COLUMN     "lastUpdatedTimestamp" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "TwitchBotAuth" (
    "id" TEXT NOT NULL,
    "oauthId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "scope" TEXT[],
    "expiryInMS" INTEGER NOT NULL,
    "obtainmentEpoch" INTEGER NOT NULL,
    "lastUpdatedTimestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwitchBotAuth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwitchStreamerAuth" (
    "id" TEXT NOT NULL,
    "oauthId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "scope" TEXT[],
    "expiryInMS" INTEGER NOT NULL,
    "obtainmentEpoch" INTEGER NOT NULL,
    "lastUpdatedTimestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwitchStreamerAuth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TwitchBotAuth_oauthId_key" ON "TwitchBotAuth"("oauthId");

-- CreateIndex
CREATE UNIQUE INDEX "TwitchStreamerAuth_oauthId_key" ON "TwitchStreamerAuth"("oauthId");
