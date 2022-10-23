-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sid" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwitchUser" (
    "id" TEXT NOT NULL,
    "oauthId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "accountCreated" TIMESTAMP(3) NOT NULL,
    "email" TEXT NOT NULL,
    "profileImageUrl" TEXT NOT NULL,
    "lastUpdatedTimestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwitchUser_pkey" PRIMARY KEY ("id")
);

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
CREATE UNIQUE INDEX "Session_sid_key" ON "Session"("sid");

-- CreateIndex
CREATE UNIQUE INDEX "TwitchUser_oauthId_key" ON "TwitchUser"("oauthId");

-- CreateIndex
CREATE UNIQUE INDEX "TwitchBotAuth_oauthId_key" ON "TwitchBotAuth"("oauthId");

-- CreateIndex
CREATE UNIQUE INDEX "TwitchStreamerAuth_oauthId_key" ON "TwitchStreamerAuth"("oauthId");
