'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import {
  LayoutDashboard,
  Zap,
  Activity,
  DollarSign,
  Users,
  Settings,
  X,
  BarChart3,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navigationItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Build Cycles', href: '/build-cycles', icon: Zap },
  { name: 'Activity', href: '/activity', icon: Activity },
  { name: 'Earnings', href: '/earnings', icon: DollarSign },
  { name: 'Team', href: '/team', icon: Users },
  { name: 'Insights', href: '/insights', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-64 bg-gray-950 border-r border-gray-800/50
          transform transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo & Title */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800/50">
            <div className="flex items-center space-x-3">
              <Image
                src="/logo.png"
                alt="Builder's Circle"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <h1 className="text-lg font-semibold text-gray-100">
                Builder's Circle
              </h1>
            </div>
            <button
              onClick={onClose}
              className="lg:hidden p-1 rounded-md hover:bg-gray-800 transition-colors"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => onClose()}
                  className={`
                    flex items-center space-x-3 px-3 py-2.5 rounded-lg
                    transition-all duration-200 group
                    ${
                      isActive
                        ? 'bg-indigo-600/10 text-indigo-400'
                        : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                    }
                  `}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon
                    className={`w-5 h-5 transition-colors ${
                      isActive ? 'text-indigo-400' : 'group-hover:text-gray-200'
                    }`}
                  />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-800/50">
            <p className="text-xs text-gray-500">© 2026 Builder's Circle</p>
          </div>
        </div>
      </aside>
    </>
  );
}
