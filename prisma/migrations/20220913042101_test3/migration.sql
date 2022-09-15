-- CreateTable
CREATE TABLE "TestUser" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "TestUser_id_key" ON "TestUser"("id");
