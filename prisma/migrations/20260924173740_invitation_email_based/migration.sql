/*
  Warnings:

  - A unique constraint covering the columns `[assessmentId,email]` on the table `invitations` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `email` to the `invitations` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "invitations" DROP CONSTRAINT "invitations_candidateId_fkey";

-- DropIndex
DROP INDEX "invitations_assessmentId_candidateId_key";

-- AlterTable
ALTER TABLE "invitations" ADD COLUMN     "email" TEXT NOT NULL,
ALTER COLUMN "candidateId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "invitations_email_idx" ON "invitations"("email");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_assessmentId_email_key" ON "invitations"("assessmentId", "email");

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
