-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_document_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "versionNumber" INTEGER NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_versions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "document_versions_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_document_versions" ("createdAt", "documentId", "filePath", "id", "mimeType", "uploadedBy", "versionNumber") SELECT "createdAt", "documentId", "filePath", "id", "mimeType", "uploadedBy", "versionNumber" FROM "document_versions";
DROP TABLE "document_versions";
ALTER TABLE "new_document_versions" RENAME TO "document_versions";
CREATE TABLE "new_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "size" INTEGER NOT NULL DEFAULT 0,
    "securityLabel" TEXT NOT NULL DEFAULT 'internal',
    "folderId" TEXT,
    "createdBy" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "documents_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "doc_folders" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "documents_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_documents" ("createdAt", "createdBy", "filePath", "folderId", "id", "isActive", "mimeType", "securityLabel", "size", "title", "updatedAt") SELECT "createdAt", "createdBy", "filePath", "folderId", "id", "isActive", "mimeType", "securityLabel", "size", "title", "updatedAt" FROM "documents";
DROP TABLE "documents";
ALTER TABLE "new_documents" RENAME TO "documents";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
