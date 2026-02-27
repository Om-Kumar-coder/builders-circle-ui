'use client';

import { useAuth } from '../../context/AuthContext';
import { User, Shield, Briefcase, Eye, Users } from 'lucide-react';

const roleIcons = {
  founder: Shield,
  admin: Shield,
  contributor: Users,
  employee: Briefcase,
  observer: Eye,
};

const roleColors = {
  founder: 'text-purple-400',
  admin: 'text-purple-400',
  contributor: 'text-blue-400',
  employee: 'text-green-400',
  observer: 'text-gray-400',
};

export default function UserProfile() {
  const { user } = useAuth();

  if (!user) return null;

  const role = user.role || 'contributor';
  const Icon = roleIcons[role];
  const colorClass = roleColors[role];

  return (
    <div className="flex items-center gap-3 bg-gray-700 px-4 py-3 rounded-lg">
      <div className="bg-gray-600 p-2 rounded-full">
        <User className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-white">{user.name}</p>
        <div className="flex items-center gap-1">
          <Icon className={`w-3 h-3 ${colorClass}`} />
          <p className={`text-xs ${colorClass} capitalize`}>{role}</p>
        </div>
      </div>
    </div>
  );
}
