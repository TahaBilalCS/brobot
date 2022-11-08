-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sid" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwitchBotAuth" (
    "id" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "scope" TEXT[],
    "obtainmentEpoch" INTEGER NOT NULL,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expirySeconds" INTEGER NOT NULL,
    "twitchUserId" TEXT NOT NULL,
    "updatedDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwitchBotAuth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwitchStreamerAuth" (
    "id" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "scope" TEXT[],
    "obtainmentEpoch" INTEGER NOT NULL,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expirySeconds" INTEGER NOT NULL,
    "twitchUserId" TEXT NOT NULL,
    "updatedDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwitchStreamerAuth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwitchUserRegistered" (
    "id" TEXT NOT NULL,
    "twitchUserId" TEXT NOT NULL,
    "email" TEXT,
    "profileImageUrl" TEXT NOT NULL,
    "scope" TEXT[],
    "updatedDate" TIMESTAMP(3) NOT NULL,
    "originDate" TIMESTAMP(3) NOT NULL,
    "registeredDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TwitchUserRegistered_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwitchUser" (
    "id" TEXT NOT NULL,
    "oauthId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "roles" TEXT[] DEFAULT ARRAY['Viewer']::TEXT[],
    "updatedDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwitchUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PokemonTeam" (
    "id" TEXT NOT NULL,
    "twitchUserId" TEXT NOT NULL,

    CONSTRAINT "PokemonTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pokemon" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "teamId" TEXT,
    "twitchUserId" TEXT NOT NULL,

    CONSTRAINT "Pokemon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_sid_key" ON "Session"("sid");

-- CreateIndex
CREATE UNIQUE INDEX "TwitchBotAuth_twitchUserId_key" ON "TwitchBotAuth"("twitchUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TwitchStreamerAuth_twitchUserId_key" ON "TwitchStreamerAuth"("twitchUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TwitchUserRegistered_twitchUserId_key" ON "TwitchUserRegistered"("twitchUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TwitchUser_oauthId_key" ON "TwitchUser"("oauthId");

-- CreateIndex
CREATE UNIQUE INDEX "PokemonTeam_twitchUserId_key" ON "PokemonTeam"("twitchUserId");

-- AddForeignKey
ALTER TABLE "TwitchBotAuth" ADD CONSTRAINT "TwitchBotAuth_twitchUserId_fkey" FOREIGN KEY ("twitchUserId") REFERENCES "TwitchUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwitchStreamerAuth" ADD CONSTRAINT "TwitchStreamerAuth_twitchUserId_fkey" FOREIGN KEY ("twitchUserId") REFERENCES "TwitchUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwitchUserRegistered" ADD CONSTRAINT "TwitchUserRegistered_twitchUserId_fkey" FOREIGN KEY ("twitchUserId") REFERENCES "TwitchUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PokemonTeam" ADD CONSTRAINT "PokemonTeam_twitchUserId_fkey" FOREIGN KEY ("twitchUserId") REFERENCES "TwitchUser"("oauthId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pokemon" ADD CONSTRAINT "Pokemon_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "PokemonTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pokemon" ADD CONSTRAINT "Pokemon_twitchUserId_fkey" FOREIGN KEY ("twitchUserId") REFERENCES "TwitchUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
