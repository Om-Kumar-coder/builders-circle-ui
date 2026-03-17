export type SecurityLabel = 'internal' | 'restricted' | 'confidential';
export type AccessType = 'view' | 'download';

export interface DocFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  children?: DocFolder[];
}

export interface DocumentMeta {
  id: string;
  title: string;
  mimeType: string;
  size: number;
  securityLabel: SecurityLabel;
  folderId: string | null;
  folder?: { id: string; name: string } | null;
  creator?: { id: string; email: string; name?: string };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { versions: number };
  // For non-admin users — null means no access
  access?: { type: AccessType; expiresAt: string | null } | null;
}

export interface DocumentAccess {
  id: string;
  userId: string;
  documentId: string;
  accessType: AccessType;
  expiresAt: string | null;
  grantedBy: string;
  revokedAt: string | null;
  createdAt: string;
  user?: { id: string; email: string; name?: string };
  granter?: { id: string; email: string; name?: string };
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  uploadedBy: string;
  createdAt: string;
}

export interface DocumentActivity {
  id: string;
  userId: string;
  documentId: string;
  action: string;
  timestamp: string;
  metadata?: string;
  user?: { id: string; email: string; name?: string };
}
