-- AlterTable
ALTER TABLE "campaigns"
ADD COLUMN "attachments" JSONB;

-- AlterTable
ALTER TABLE "email_jobs"
ADD COLUMN "attachments" JSONB;