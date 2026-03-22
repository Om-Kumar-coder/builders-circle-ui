'use client';

import { ExternalLink } from 'lucide-react';
import IdeaStatusBadge from './IdeaStatusBadge';
import type { Idea } from '@/hooks/useIdeas';

interface IdeaCardProps {
  idea: Idea;
  onClick?: () => void;
}

export default function IdeaCard({ idea, onClick }: IdeaCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3 ${onClick ? 'cursor-pointer hover:border-gray-600 transition-colors' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-gray-100 leading-snug">{idea.title}</h3>
        <IdeaStatusBadge status={idea.status} />
      </div>
      <p className="text-sm text-gray-400 line-clamp-3">{idea.description}</p>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{new Date(idea.createdAt).toLocaleDateString()}</span>
        {idea.cycle && (
          <a
            href={`/build-cycles`}
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <ExternalLink size={11} />
            {idea.cycle.name}
          </a>
        )}
      </div>
    </div>
  );
}
