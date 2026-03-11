'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, Menu, ChevronDown, User as UserIcon, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import NotificationBell from '../notifications/NotificationBell';

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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user, loading, logout } = useAuth();
  const router = useRouter();

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
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  // Get user initials
  const initials = user?.name 
    ? getInitials(user.name) 
    : user?.email 
    ? user.email[0].toUpperCase() 
    : '?';

  return (
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
  );
}
