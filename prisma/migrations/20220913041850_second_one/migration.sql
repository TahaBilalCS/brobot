-- CreateTable
CREATE TABLE "TwitchUser" (
    "id" TEXT NOT NULL,
    "oauthId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "accountCreated" TIMESTAMP(3) NOT NULL,
    "email" TEXT NOT NULL,
    "profileImageUrl" TEXT NOT NULL,

    CONSTRAINT "TwitchUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TwitchUser_oauthId_key" ON "TwitchUser"("oauthId");
