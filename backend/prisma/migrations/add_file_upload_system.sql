-- Migration: replace fileUrl with filePath + mimeType on documents and document_versions
-- Run this against your SQLite database after backing up dev.db

-- Step 1: Add new columns to documents
ALTER TABLE "documents" ADD COLUMN "filePath" TEXT NOT NULL DEFAULT '';
ALTER TABLE "documents" ADD COLUMN "mimeType" TEXT NOT NULL DEFAULT 'application/octet-stream';

-- Step 2: Copy existing fileUrl into filePath (preserves any existing data)
UPDATE "documents" SET "filePath" = "fileUrl", "mimeType" = "fileType";

-- Step 3: Add new columns to document_versions
ALTER TABLE "document_versions" ADD COLUMN "filePath" TEXT NOT NULL DEFAULT '';
ALTER TABLE "document_versions" ADD COLUMN "mimeType" TEXT NOT NULL DEFAULT 'application/octet-stream';

-- Step 4: Copy existing data
UPDATE "document_versions" SET "filePath" = "fileUrl";

-- NOTE: SQLite does not support DROP COLUMN in older versions.
-- The old fileUrl / fileType columns are left in place but are no longer used by the application.
-- If you are on SQLite 3.35+ you may optionally run:
--   ALTER TABLE "documents" DROP COLUMN "fileUrl";
--   ALTER TABLE "documents" DROP COLUMN "fileType";
--   ALTER TABLE "document_versions" DROP COLUMN "fileUrl";
