-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_userId_fkey";

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "guestEmail" TEXT,
ADD COLUMN     "guestName" TEXT,
ADD COLUMN     "guestPhone" TEXT,
ADD COLUMN     "personnummer" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "behorighet" TEXT NOT NULL DEFAULT 'B';

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "visibility" TEXT NOT NULL DEFAULT 'public';

-- CreateTable
CREATE TABLE "Settings" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Settings_key_key" ON "Settings"("key");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
