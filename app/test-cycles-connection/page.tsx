'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api-client';

export default function TestCyclesConnection() {
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testConnection = async () => {
    setStatus('testing');
    setError(null);
    setResult(null);

    try {
      console.log('Testing API connection...');
      console.log('API URL:', process.env.NEXT_PUBLIC_API_URL);

      const response = await apiClient.getCycles();

      console.log('✅ Success! Response:', response);
      setResult({
        total: response.length,
        documents: response
      });
      setStatus('success');
    } catch (err: any) {
      console.error('❌ Error:', err);
      setError(err.message || 'Unknown error');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">API Connection Test</h1>
        <p className="text-gray-400 mb-8">Test if the app can connect to the backend API and retrieve build cycles data</p>

        {/* Environment Variables */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Environment Configuration</h2>
          <div className="space-y-2 font-mono text-sm">
            <div className="flex gap-2">
              <span className="text-gray-500">API URL:</span>
              <span className="text-green-400">{process.env.NEXT_PUBLIC_API_URL || '❌ Not set'}</span>
            </div>
          </div>
        </div>

        {/* Test Button */}
        <button
          onClick={testConnection}
          disabled={status === 'testing'}
          className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed mb-6"
        >
          {status === 'testing' ? 'Testing Connection...' : 'Test Connection'}
        </button>

        {/* Results */}
        {status === 'success' && result && (
          <div className="bg-green-900/20 border border-green-800/50 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-green-400 mb-4">✅ Connection Successful!</h2>
            <div className="space-y-4">
              <div>
                <p className="text-gray-400 mb-2">Total cycles found: <span className="text-white font-semibold">{result.total}</span></p>
              </div>
              
              {result.documents.length > 0 ? (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Cycles:</h3>
                  <div className="space-y-3">
                    {result.documents.map((cycle: any, index: number) => (
                      <div key={cycle.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-lg">{index + 1}. {cycle.name}</h4>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            cycle.state === 'active' ? 'bg-green-900/50 text-green-400' :
                            cycle.state === 'planned' ? 'bg-blue-900/50 text-blue-400' :
                            cycle.state === 'paused' ? 'bg-yellow-900/50 text-yellow-400' :
                            'bg-gray-800 text-gray-400'
                          }`}>
                            {cycle.state}
                          </span>
                        </div>
                        <div className="text-sm text-gray-400 space-y-1">
                          <p>Start: {new Date(cycle.startDate).toLocaleDateString()}</p>
                          <p>End: {new Date(cycle.endDate).toLocaleDateString()}</p>
                          <p>Participants: {cycle.participantCount || 0}</p>
                          <p className="text-xs text-gray-500">ID: {cycle.id}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-gray-400">No cycles found in the database. This is normal if you haven't created any yet.</p>
              )}

              <details className="mt-4">
                <summary className="cursor-pointer text-gray-400 hover:text-white">View raw response</summary>
                <pre className="mt-2 bg-gray-950 border border-gray-800 rounded p-4 overflow-auto text-xs">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-400 mb-4">❌ Connection Failed</h2>
            <p className="text-red-300 mb-4 font-mono text-sm">{error}</p>
            
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <h3 className="font-semibold mb-2">Common Issues:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-400">
                <li>Check if .env.local file exists with correct API URL</li>
                <li>Verify backend server is running on the correct port</li>
                <li>Check if authentication token is valid</li>
                <li>Ensure backend API endpoints are accessible</li>
                <li>Check network connectivity to backend</li>
              </ul>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">How to Use This Test</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-400">
            <li>Make sure your .env.local file is configured with the API URL</li>
            <li>Ensure the backend server is running</li>
            <li>Click the "Test Connection" button above</li>
            <li>Check the results - green means success, red means there's an issue</li>
            <li>Open browser DevTools (F12) to see detailed console logs</li>
            <li>If successful, your build cycles page should work correctly</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
