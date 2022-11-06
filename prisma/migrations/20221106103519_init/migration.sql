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

-- CreateTable
CREATE TABLE "TwitchUser" (
    "id" TEXT NOT NULL,
    "oauthId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "accountCreated" TIMESTAMP(3) NOT NULL,
    "email" TEXT NOT NULL,
    "profileImageUrl" TEXT NOT NULL,
    "lastUpdatedTimestamp" TIMESTAMP(3) NOT NULL,
    "scope" TEXT[],

    CONSTRAINT "TwitchUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PokemonTeam" (
    "id" TEXT NOT NULL,
    "twitchOauthId" TEXT NOT NULL,
    "slot1Id" TEXT,

    CONSTRAINT "PokemonTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pokemon" (
    "id" TEXT NOT NULL,
    "twitchOauthId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Pokemon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_sid_key" ON "Session"("sid");

-- CreateIndex
CREATE UNIQUE INDEX "TwitchBotAuth_oauthId_key" ON "TwitchBotAuth"("oauthId");

-- CreateIndex
CREATE UNIQUE INDEX "TwitchStreamerAuth_oauthId_key" ON "TwitchStreamerAuth"("oauthId");

-- CreateIndex
CREATE UNIQUE INDEX "TwitchUser_oauthId_key" ON "TwitchUser"("oauthId");

-- CreateIndex
CREATE UNIQUE INDEX "PokemonTeam_twitchOauthId_key" ON "PokemonTeam"("twitchOauthId");

-- CreateIndex
CREATE UNIQUE INDEX "PokemonTeam_slot1Id_key" ON "PokemonTeam"("slot1Id");

-- AddForeignKey
ALTER TABLE "PokemonTeam" ADD CONSTRAINT "PokemonTeam_twitchOauthId_fkey" FOREIGN KEY ("twitchOauthId") REFERENCES "TwitchUser"("oauthId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PokemonTeam" ADD CONSTRAINT "PokemonTeam_slot1Id_fkey" FOREIGN KEY ("slot1Id") REFERENCES "Pokemon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pokemon" ADD CONSTRAINT "Pokemon_twitchOauthId_fkey" FOREIGN KEY ("twitchOauthId") REFERENCES "TwitchUser"("oauthId") ON DELETE RESTRICT ON UPDATE CASCADE;
