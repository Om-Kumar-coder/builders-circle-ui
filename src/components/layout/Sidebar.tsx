'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
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
  Shield,
  CheckCircle,
  Clock,
  FileText,
  ListTodo,
  Lock,
  Lightbulb,
  Bolt,
} from 'lucide-react';
import type { Permission } from '@/lib/permissions';
import { isGatekeeper } from '@/lib/permissions';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  /** Permission required to access this route. Omit = always accessible. */
  permission?: Permission;
}

const navigationItems: NavItem[] = [
  { name: 'Dashboard',    href: '/dashboard',    icon: LayoutDashboard },
  { name: 'Build Cycles', href: '/build-cycles', icon: Zap },
  { name: 'Activity',     href: '/activity',     icon: Activity },
  { name: 'Earnings',     href: '/earnings',     icon: DollarSign,  permission: 'ownership:view_own' },
  { name: 'Docs Vault',   href: '/docs',         icon: FileText,    permission: 'docs:view' },
  { name: 'Ideas',        href: '/ideas',        icon: Lightbulb,   permission: 'ideas:submit' },
  { name: 'Team',         href: '/team',         icon: Users },
  { name: 'Insights',     href: '/insights',     icon: BarChart3,   permission: 'activity:submit' },
  { name: 'Settings',     href: '/settings',     icon: Settings },
];

const adminItems: NavItem[] = [
  { name: 'Admin Dashboard', href: '/admin',                icon: Shield },
  { name: 'Activity Review', href: '/admin/activity-review',icon: CheckCircle },
  { name: 'Analytics',       href: '/admin/analytics',      icon: BarChart3 },
  { name: 'Audit Logs',      href: '/admin/audit',          icon: Clock },
  { name: 'Agreements',      href: '/admin/agreements',     icon: FileText },
  { name: 'Tasks',           href: '/admin/tasks',          icon: ListTodo },
  { name: 'Groups',          href: '/admin/groups',         icon: Users },
  { name: 'Triage',          href: '/admin/triage',         icon: CheckCircle },
  { name: 'Ideas',           href: '/admin/ideas',          icon: Lightbulb },
  { name: 'Docs Vault',      href: '/admin/docs',           icon: Shield },
  { name: 'Foundation Phase', href: '/admin/foundation-phase', icon: Bolt },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { isAdmin, can } = usePermissions();

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
                Builder&apos;s Circle
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
              const locked = !!item.permission && !can(item.permission);

              if (locked) {
                return (
                  <div
                    key={item.name}
                    title="You do not have access"
                    aria-disabled="true"
                    className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-gray-600 cursor-not-allowed select-none"
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium flex-1">{item.name}</span>
                    <Lock className="w-3.5 h-3.5 shrink-0" aria-label="Locked" />
                  </div>
                );
              }

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

            {/* Admin Section */}
            {isAdmin && (
              <>
                <div className="pt-4 pb-2">
                  <div className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Administration
                  </div>
                </div>
                {adminItems.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link key={item.name} href={item.href} onClick={() => onClose()}
                      className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                        isActive ? 'bg-red-600/10 text-red-400' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                      }`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon className={`w-5 h-5 transition-colors ${isActive ? 'text-red-400' : 'group-hover:text-gray-200'}`} />
                      <span className="font-medium">{item.name}</span>
                    </Link>
                  );
                })}
              </>
            )}

            {/* Gatekeeper (Veronica) Section */}
            {isGatekeeper(user) && (
              <>
                <div className="pt-4 pb-2">
                  <div className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Veronica
                  </div>
                </div>
                {[
                  { name: 'Gatekeeper', href: '/gatekeeper', icon: Shield },
                  { name: 'User Intake', href: '/gatekeeper/intake', icon: Users },
                  { name: 'Submissions', href: '/gatekeeper/submissions', icon: CheckCircle },
                  { name: 'Returned', href: '/gatekeeper/returned', icon: Clock },
                  { name: 'Daily Reports', href: '/gatekeeper/reports', icon: BarChart3 },
                ].map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link key={item.name} href={item.href} onClick={() => onClose()}
                      className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                        isActive ? 'bg-violet-600/10 text-violet-400' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                      }`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon className={`w-5 h-5 transition-colors ${isActive ? 'text-violet-400' : 'group-hover:text-gray-200'}`} />
                      <span className="font-medium">{item.name}</span>
                    </Link>
                  );
                })}
              </>
            )}
          </nav>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-800/50">
            <p className="text-xs text-gray-500">© 2026 Builder&apos;s Circle</p>
          </div>
        </div>
      </aside>
    </>
  );
}
