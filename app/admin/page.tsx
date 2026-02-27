'use client';

import { useAuth } from '../../src/context/AuthContext';
import MainLayout from '../../src/components/layout/MainLayout';
import { Shield } from 'lucide-react';

export default function AdminPage() {
  const { user } = useAuth();

  return (
    <MainLayout title="Admin Dashboard">
      <div className="max-w-7xl mx-auto">
        <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700">
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-purple-600 p-3 rounded-full">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
              <p className="text-gray-400">Welcome, {user?.name}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <div className="bg-gray-700 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-white mb-2">User Management</h3>
              <p className="text-gray-400">Manage users and permissions</p>
            </div>
            
            <div className="bg-gray-700 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-white mb-2">System Settings</h3>
              <p className="text-gray-400">Configure system parameters</p>
            </div>
            
            <div className="bg-gray-700 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-white mb-2">Analytics</h3>
              <p className="text-gray-400">View system analytics</p>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
