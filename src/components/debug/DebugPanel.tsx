'use client';

import { useState, useEffect } from 'react';
import { Bug, X } from 'lucide-react';

interface DebugLog {
  id: string;
  timestamp: string;
  type: 'request' | 'response' | 'error' | 'info';
  message: string;
  data?: unknown;
}

export default function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [lastApiRequest, setLastApiRequest] = useState<unknown>(null);
  const [lastApiResponse, setLastApiResponse] = useState<unknown>(null);

  // Listen for console logs (in development only)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;

    console.log = (...args) => {
      originalConsoleLog(...args);
      
      // Capture API-related logs
      const message = args[0];
      if (typeof message === 'string' && (
          message.includes('🌐 API Request:') || message.includes('📥 API Response:') || 
          message.includes('🚀') || message.includes('✅') || message.includes('❌'))) {
        
        const newLog: DebugLog = {
          id: Date.now().toString(),
          timestamp: new Date().toLocaleTimeString(),
          type: message.includes('❌') ? 'error' : message.includes('🌐') ? 'request' : 'response',
          message,
          data: args.length > 1 ? args.slice(1) : undefined
        };

        setLogs(prev => [newLog, ...prev.slice(0, 49)]); // Keep last 50 logs

        // Track last API request/response
        if (message.includes('🌐 API Request:') && args[1]) {
          setLastApiRequest(args[1]);
        } else if (message.includes('📥 API Response:') && args[1]) {
          setLastApiResponse(args[1]);
        }
      }
    };

    console.error = (...args) => {
      originalConsoleError(...args);
      
      const message = args.join(' ');
      const newLog: DebugLog = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString(),
        type: 'error',
        message,
        data: args.length > 1 ? args.slice(1) : undefined
      };

      setLogs(prev => [newLog, ...prev.slice(0, 49)]);
    };

    return () => {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
    };
  }, []);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <>
      {/* Debug Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-50 bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full shadow-lg transition-colors"
        title="Toggle Debug Panel"
      >
        <Bug className="w-5 h-5" />
      </button>

      {/* Debug Panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-96 max-h-96 overflow-hidden animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center justify-between p-3 border-b border-gray-700">
            <h3 className="text-sm font-medium text-gray-100 flex items-center gap-2">
              <Bug className="w-4 h-4" />
              Debug Panel
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 space-y-3 max-h-80 overflow-y-auto">
            {/* Last API Request/Response */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-300">Last API Request:</div>
              <div className="bg-gray-800 p-2 rounded text-xs text-gray-400 font-mono">
                {lastApiRequest ? (
                  <pre>{JSON.stringify(lastApiRequest, null, 2)}</pre>
                ) : (
                  'No request yet'
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-300">Last API Response:</div>
              <div className="bg-gray-800 p-2 rounded text-xs text-gray-400 font-mono">
                {lastApiResponse ? (
                  <pre>{JSON.stringify(lastApiResponse, null, 2)}</pre>
                ) : (
                  'No response yet'
                )}
              </div>
            </div>

            {/* Recent Logs */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-300">Recent Logs ({logs.length}):</div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {logs.length === 0 ? (
                  <div className="text-xs text-gray-500">No logs yet</div>
                ) : (
                  logs.slice(0, 10).map((log) => (
                    <div
                      key={log.id}
                      className={`text-xs p-2 rounded ${
                        log.type === 'error'
                          ? 'bg-red-900/20 text-red-400'
                          : log.type === 'request'
                          ? 'bg-blue-900/20 text-blue-400'
                          : 'bg-green-900/20 text-green-400'
                      }`}
                    >
                      <div className="font-mono text-xs opacity-75">{log.timestamp}</div>
                      <div className="break-words">{log.message}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Clear Logs Button */}
            <button
              onClick={() => setLogs([])}
              className="w-full text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded transition-colors"
            >
              Clear Logs
            </button>
          </div>
        </div>
      )}
    </>
  );
}