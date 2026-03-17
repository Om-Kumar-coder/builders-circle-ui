-- Docs Vault migration

CREATE TABLE IF NOT EXISTS "doc_folders" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "name"      TEXT NOT NULL,
  "parentId"  TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("parentId") REFERENCES "doc_folders"("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "documents" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "title"         TEXT NOT NULL,
  "fileUrl"       TEXT NOT NULL,
  "fileType"      TEXT NOT NULL,
  "size"          INTEGER NOT NULL DEFAULT 0,
  "securityLabel" TEXT NOT NULL DEFAULT 'internal',
  "folderId"      TEXT,
  "createdBy"     TEXT NOT NULL,
  "isActive"      BOOLEAN NOT NULL DEFAULT 1,
  "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("folderId")  REFERENCES "doc_folders"("id") ON DELETE SET NULL,
  FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "document_access" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "userId"     TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "accessType" TEXT NOT NULL DEFAULT 'view',
  "expiresAt"  DATETIME,
  "grantedBy"  TEXT NOT NULL,
  "revokedAt"  DATETIME,
  "createdAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId")     REFERENCES "users"("id") ON DELETE CASCADE,
  FOREIGN KEY ("grantedBy")  REFERENCES "users"("id") ON DELETE CASCADE,
  FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "document_versions" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "documentId"    TEXT NOT NULL,
  "fileUrl"       TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "uploadedBy"    TEXT NOT NULL,
  "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE,
  FOREIGN KEY ("uploadedBy") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "document_activity" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "userId"     TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "action"     TEXT NOT NULL,
  "timestamp"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata"   TEXT,
  FOREIGN KEY ("userId")     REFERENCES "users"("id") ON DELETE CASCADE,
  FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE
);
