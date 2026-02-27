'use client';

import { useState, useEffect, useCallback } from 'react';
import { functions } from '../lib/appwrite';

interface OwnershipResponse {
  success: boolean;
  totalOwnership: number;
  multiplier: number;
  effectiveOwnership: number;
  entriesCount?: number;
  error?: string;
  message?: string; // For test/minimal function responses
  timestamp?: string; // For test/minimal function responses
}

interface OwnershipData {
  vested: number;
  provisional: number;
  multiplier: number;
  effective: number;
}

interface UseOwnershipDataResult {
  data: OwnershipData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useOwnershipData(
  userId: string,
  cycleId: string,
  refreshInterval: number = 60000
): UseOwnershipDataResult {
  const [data, setData] = useState<OwnershipData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOwnership = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const USE_MOCK_DATA = false;

      if (USE_MOCK_DATA) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Mock response
        const result: OwnershipResponse = {
          success: true,
          totalOwnership: 20,
          multiplier: 0.75,
          effectiveOwnership: 15,
          entriesCount: 15,
        };

        const vested = result.totalOwnership * 0.6;
        const provisional = result.totalOwnership * 0.4;

        setData({
          vested: parseFloat(vested.toFixed(2)),
          provisional: parseFloat(provisional.toFixed(2)),
          multiplier: result.multiplier,
          effective: result.effectiveOwnership,
        });

        return;
      }

      // Real Appwrite function call
      const functionId = process.env.NEXT_PUBLIC_APPWRITE_FUNCTION_ID || 'computeOwnership';
      console.log('Calling function:', functionId);
      
      const response = await functions.createExecution(
        functionId,
        JSON.stringify({ userId, cycleId }),
        false
      );

      console.log('Function response:', response);
      console.log('Response body:', response.responseBody);
      console.log('Response body type:', typeof response.responseBody);
      console.log('Response body length:', response.responseBody?.length);
      console.log('Response status:', response.responseStatusCode);

      // Check for empty response
      if (!response.responseBody || response.responseBody.trim() === '') {
        console.error('Empty response. Full response object:', JSON.stringify(response, null, 2));
        throw new Error('Function returned empty response. Status: ' + response.responseStatusCode + '. Check function logs in Appwrite console.');
      }

      // Check for HTML error responses (503, 500, etc.)
      if (response.responseBody.includes('<!DOCTYPE html>') || response.responseBody.includes('<html')) {
        throw new Error('Function returned an error. Please check function logs and ensure it is properly deployed.');
      }

      // Check if response is the Appwrite welcome message (function not deployed)
      if (response.responseBody.includes('motto') || response.responseBody.includes('Build like a team')) {
        throw new Error('Function not properly deployed. Please redeploy the computeOwnership function.');
      }

      // Validate JSON before parsing
      let result: OwnershipResponse;
      try {
        result = JSON.parse(response.responseBody);
      } catch (parseError) {
        console.error('Failed to parse response:', response.responseBody);
        console.error('Parse error:', parseError);
        throw new Error(`Invalid JSON response from function. Response: "${response.responseBody.substring(0, 200)}"`);
      }

      console.log('Parsed result:', result);

      // Handle test/minimal function response
      if (result.message && result.message.includes('Function is alive')) {
        console.warn('Function is running in test mode. Using mock data.');
        setData({
          vested: 12,
          provisional: 8,
          multiplier: 1,
          effective: 20,
        });
        return;
      }

      if (!result.success) {
        console.error('Function returned error:', result.error);
        throw new Error(result.error || 'Failed to fetch ownership data');
      }

      // Derive vested and provisional from total
      // For demo: 60% vested, 40% provisional
      const vested = result.totalOwnership * 0.6;
      const provisional = result.totalOwnership * 0.4;

      setData({
        vested: parseFloat(vested.toFixed(2)),
        provisional: parseFloat(provisional.toFixed(2)),
        multiplier: result.multiplier,
        effective: result.effectiveOwnership,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error fetching ownership data:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, cycleId]);

  useEffect(() => {
    fetchOwnership();

    // Set up auto-refresh
    const interval = setInterval(fetchOwnership, refreshInterval);

    return () => clearInterval(interval);
  }, [fetchOwnership, refreshInterval]);

  return {
    data,
    loading,
    error,
    refetch: fetchOwnership,
  };
}
