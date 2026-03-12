'use client';

import { useAuth } from '../../src/context/AuthContext';
import MainLayout from '../../src/components/layout/MainLayout';
import Link from 'next/link';
import { Shield, Users, Settings, BarChart3, CheckCircle, Clock } from 'lucide-react';

export default function AdminPage() {
  const { user } = useAuth();

  const adminActions = [
    {
      title: 'Activity Review',
      description: 'Review and verify submitted activities',
      icon: CheckCircle,
      href: '/admin/activity-review',
      color: 'bg-green-600',
    },
    {
      title: 'User Management',
      description: 'Manage users and permissions',
      icon: Users,
      href: '/admin/users',
      color: 'bg-blue-600',
    },
    {
      title: 'Audit Logs',
      description: 'View system audit trail',
      icon: Clock,
      href: '/admin/audit',
      color: 'bg-purple-600',
    },
    {
      title: 'System Settings',
      description: 'Configure system parameters',
      icon: Settings,
      href: '/admin/settings',
      color: 'bg-gray-600',
    },
    {
      title: 'Analytics',
      description: 'View system analytics and reports',
      icon: BarChart3,
      href: '/admin/analytics',
      color: 'bg-indigo-600',
    },
  ];

  return (
    <MainLayout title="Admin Dashboard">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-purple-600 p-3 rounded-full">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
              <p className="text-gray-400">Welcome, {user?.name}</p>
            </div>
          </div>
        </div>

        {/* Admin Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {adminActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 
                  transition-colors group"
              >
                <div className="flex items-start gap-4">
                  <div className={`${action.color} p-3 rounded-lg group-hover:scale-105 transition-transform`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-indigo-400 transition-colors">
                      {action.title}
                    </h3>
                    <p className="text-gray-400 text-sm">{action.description}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Quick Stats */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Quick Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-sm text-gray-400">Pending Activities</p>
              <p className="text-2xl font-bold text-yellow-400">-</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-sm text-gray-400">Active Users</p>
              <p className="text-2xl font-bold text-green-400">-</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-sm text-gray-400">Active Cycles</p>
              <p className="text-2xl font-bold text-blue-400">-</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-sm text-gray-400">Total Activities</p>
              <p className="text-2xl font-bold text-indigo-400">-</p>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
