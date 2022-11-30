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
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expirySeconds" INTEGER NOT NULL,
    "userOauthId" TEXT NOT NULL,
    "updatedDate" TIMESTAMP(3) NOT NULL,
    "obtainmentEpoch" BIGINT NOT NULL,

    CONSTRAINT "TwitchBotAuth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwitchStreamerAuth" (
    "id" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "scope" TEXT[],
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expirySeconds" INTEGER NOT NULL,
    "userOauthId" TEXT NOT NULL,
    "updatedDate" TIMESTAMP(3) NOT NULL,
    "obtainmentEpoch" BIGINT NOT NULL,

    CONSTRAINT "TwitchStreamerAuth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwitchUserRegistered" (
    "id" TEXT NOT NULL,
    "userOauthId" TEXT NOT NULL,
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
    "oauthId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "roles" TEXT[] DEFAULT ARRAY['Viewer']::TEXT[],
    "updatedDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwitchUser_pkey" PRIMARY KEY ("oauthId")
);

-- CreateTable
CREATE TABLE "PokemonTeam" (
    "id" TEXT NOT NULL,
    "userOauthId" TEXT NOT NULL,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PokemonTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pokemon" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "shiny" BOOLEAN NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "item" TEXT NOT NULL DEFAULT '',
    "moves" TEXT[],
    "dexNum" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "types" TEXT[],
    "gender" TEXT NOT NULL,
    "nature" TEXT NOT NULL,
    "ability" TEXT NOT NULL,
    "teamId" TEXT,
    "userOauthId" TEXT NOT NULL,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pokemon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PokemonBattleOutcome" (
    "id" TEXT NOT NULL,
    "updatedDate" TIMESTAMP(3) NOT NULL,
    "outcome" TEXT[],

    CONSTRAINT "PokemonBattleOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PokemonTeamBattleOutcome" (
    "id" TEXT NOT NULL,
    "updatedDate" TIMESTAMP(3) NOT NULL,
    "outcome" TEXT[],

    CONSTRAINT "PokemonTeamBattleOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_sid_key" ON "Session"("sid");

-- CreateIndex
CREATE UNIQUE INDEX "TwitchBotAuth_userOauthId_key" ON "TwitchBotAuth"("userOauthId");

-- CreateIndex
CREATE UNIQUE INDEX "TwitchStreamerAuth_userOauthId_key" ON "TwitchStreamerAuth"("userOauthId");

-- CreateIndex
CREATE UNIQUE INDEX "TwitchUserRegistered_userOauthId_key" ON "TwitchUserRegistered"("userOauthId");

-- CreateIndex
CREATE UNIQUE INDEX "TwitchUser_oauthId_key" ON "TwitchUser"("oauthId");

-- CreateIndex
CREATE UNIQUE INDEX "PokemonTeam_userOauthId_key" ON "PokemonTeam"("userOauthId");

-- AddForeignKey
ALTER TABLE "TwitchBotAuth" ADD CONSTRAINT "TwitchBotAuth_userOauthId_fkey" FOREIGN KEY ("userOauthId") REFERENCES "TwitchUser"("oauthId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwitchStreamerAuth" ADD CONSTRAINT "TwitchStreamerAuth_userOauthId_fkey" FOREIGN KEY ("userOauthId") REFERENCES "TwitchUser"("oauthId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwitchUserRegistered" ADD CONSTRAINT "TwitchUserRegistered_userOauthId_fkey" FOREIGN KEY ("userOauthId") REFERENCES "TwitchUser"("oauthId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PokemonTeam" ADD CONSTRAINT "PokemonTeam_userOauthId_fkey" FOREIGN KEY ("userOauthId") REFERENCES "TwitchUser"("oauthId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pokemon" ADD CONSTRAINT "Pokemon_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "PokemonTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pokemon" ADD CONSTRAINT "Pokemon_userOauthId_fkey" FOREIGN KEY ("userOauthId") REFERENCES "TwitchUser"("oauthId") ON DELETE CASCADE ON UPDATE CASCADE;
