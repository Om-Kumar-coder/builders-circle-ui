'use client';

import RejectModal from '@/components/triage/RejectModal';

interface RejectIdeaModalProps {
  ideaTitle: string;
  onConfirm: (note?: string) => Promise<void>;
  onClose: () => void;
}

export default function RejectIdeaModal({ ideaTitle, onConfirm, onClose }: RejectIdeaModalProps) {
  return (
    <RejectModal
      title={`Reject idea: "${ideaTitle}"`}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}
