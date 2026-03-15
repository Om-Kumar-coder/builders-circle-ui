'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, Menu, ChevronDown, User as UserIcon, LogOut, MessageSquare, X } from 'lucide-react';
import { apiClient } from '@/lib/api-client';import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import NotificationBell from '../notifications/NotificationBell';
import CycleDiscussion from '../messaging/CycleDiscussion';
import { useCycles } from '@/hooks/useCycles';

interface HeaderProps {
  title?: string;
  onMenuClick: () => void;
}

function getInitials(name: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function Header({ title = 'Dashboard', onMenuClick }: HeaderProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMessagingOpen, setIsMessagingOpen] = useState(false);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const { cycles } = useCycles();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user) return;
      try {
        const { count } = await apiClient.getUnreadMessageCount();
        if (!cancelled) setUnreadCount(count);
      } catch {
        // silently fail
      }
    };
    load();
    const interval = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user]);

  // Auto-select the first active cycle
  useEffect(() => {
    if (cycles.length > 0 && !selectedCycleId) {
      const active = cycles.find(c => c.state === 'active') || cycles[0];
      // Use setTimeout to avoid setState during render
      setTimeout(() => setSelectedCycleId(active.id), 0);
    }
  }, [cycles, selectedCycleId]);

  const selectedCycle = cycles.find(c => c.id === selectedCycleId);
  const participants = ((selectedCycle as { participants?: Array<{ user?: { id: string; name?: string; email: string } } & { id: string; name?: string; email: string }> })?.participants?.map((p) => p.user ?? p) ?? []) as { id: string; name?: string; email: string }[];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleLogout() {
    try {
      await logout();
    } catch {
      console.error('Logout failed');
    }
  }

  // Get user initials
  const initials = user?.name 
    ? getInitials(user.name) 
    : user?.email 
    ? user.email[0].toUpperCase() 
    : '?';

  return (
    <>
    <header className="sticky top-0 z-30 bg-gray-950/80 backdrop-blur-sm border-b border-gray-800/50">
      <div className="flex items-center justify-between px-4 lg:px-6 py-4">
        {/* Left: Menu + Title */}
        <div className="flex items-center space-x-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-800 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5 text-gray-400" />
          </button>
          <h2 className="text-xl font-semibold text-gray-100">{title}</h2>
        </div>

        {/* Center: Search */}
        <div className="hidden md:flex flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg
                text-gray-200 placeholder-gray-500 text-sm
                focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500
                transition-all duration-200"
              aria-label="Search"
            />
          </div>
        </div>

        {/* Right: Notifications + User */}
        <div className="flex items-center space-x-3">
          {/* Messaging */}
          {user && (
            <button
              onClick={() => { setIsMessagingOpen(true); setUnreadCount(0); }}
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors relative"
              aria-label="Open messaging"
            >
              <MessageSquare className="w-5 h-5 text-gray-400" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-indigo-500 
                  text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          )}

          {/* Notifications */}
          {user && <NotificationBell userId={user.id} />}

          {/* User Menu */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
              aria-label="User menu"
              aria-expanded={isDropdownOpen}
            >
              {loading ? (
                // Loading skeleton
                <div className="w-8 h-8 rounded-full bg-gray-800 animate-pulse" />
              ) : user ? (
                // User avatar with initials
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                  <span className="text-white text-sm font-medium">{initials}</span>
                </div>
              ) : (
                // Fallback icon
                <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                  <UserIcon className="w-4 h-4 text-gray-400" />
                </div>
              )}
              <ChevronDown
                className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                  isDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-56 bg-gray-900 border border-gray-800 rounded-lg shadow-xl
                  animate-in fade-in slide-in-from-top-2 duration-200"
              >
                {user ? (
                  <>
                    <div className="px-4 py-3 border-b border-gray-800">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-200">{user.name}</p>
                        {user.role && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-indigo-500/20 text-indigo-400 rounded-full capitalize">
                            {user.role}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{user.email}</p>
                    </div>
                    <div className="py-2">
                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          router.push('/profile');
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                      >
                        Profile
                      </button>
                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          router.push('/settings');
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                      >
                        Settings
                      </button>
                      <button
                        className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-800 transition-colors flex items-center gap-2"
                        onClick={handleLogout}
                      >
                        <LogOut className="w-4 h-4" />
                        Logout
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="px-4 py-3">
                    <p className="text-sm text-gray-400">Not logged in</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>

    {/* Messaging Slide-over */}
    {isMessagingOpen && (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMessagingOpen(false)}
          aria-hidden="true"
        />
        {/* Panel */}
        <div className="fixed top-0 right-0 z-50 h-full w-full max-w-md bg-gray-950 border-l border-gray-800 flex flex-col shadow-2xl">
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800">
            <h2 className="text-lg font-semibold text-gray-100">Messaging</h2>
            <button
              onClick={() => setIsMessagingOpen(false)}
              className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
              aria-label="Close messaging"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Cycle selector */}
          {cycles.length > 1 && (
            <div className="px-4 py-3 border-b border-gray-800">
              <label className="text-xs text-gray-500 mb-1 block">Cycle</label>
              <select
                value={selectedCycleId}
                onChange={e => setSelectedCycleId(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {cycles.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.state})</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex-1 overflow-hidden p-4 flex flex-col">
            {selectedCycleId ? (
              <CycleDiscussion cycleId={selectedCycleId} participants={participants} />
            ) : (
              <p className="text-gray-400 text-sm text-center mt-8">No cycles available</p>
            )}
          </div>
        </div>
      </>
    )}
    </>
  );
}
