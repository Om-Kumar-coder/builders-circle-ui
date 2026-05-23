'use client';

import Link from 'next/link';
import { FileQuestion, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
        <div className="flex justify-center mb-6">
          <div className="p-3 bg-gray-800/50 rounded-full border border-gray-700/50">
            <FileQuestion className="w-10 h-10 text-gray-400" />
          </div>
        </div>

        <h1 className="text-4xl font-bold text-gray-100 mb-2">404</h1>
        <p className="text-xl text-gray-300 mb-2">Page not found</p>
        <p className="text-sm text-gray-500 mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 
            text-white rounded-lg font-medium transition-colors"
        >
          <Home className="w-4 h-4" />
          Back to Home
        </Link>
      </div>
    </div>
  );
}
