'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

interface WatermarkOverlayProps {
  /** Force-show regardless of route (e.g. for admin layouts) */
  forceShow?: boolean;
}

function formatTimestamp(date: Date): string {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Generates a short, non-reversible hash from a string.
 * Used to embed a session fingerprint in the watermark without exposing raw session data.
 */
function shortHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).toUpperCase().slice(0, 6);
}

export default function WatermarkOverlay({ forceShow = false }: WatermarkOverlayProps) {
  const { user } = useAuth();
  const [timestamp, setTimestamp] = useState(() => formatTimestamp(new Date()));
  const sessionFingerprintRef = useRef<string>('');

  // Generate a session fingerprint once on mount
  useEffect(() => {
    const seed = `${user?.id ?? 'anon'}-${Date.now()}-${Math.random()}`;
    sessionFingerprintRef.current = shortHash(seed);
  }, [user?.id]);

  // Update timestamp every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTimestamp(formatTimestamp(new Date()));
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (!user && !forceShow) return null;

  const identity = user?.email ?? user?.name ?? 'Unknown User';
  const watermarkText = `${identity} • ${timestamp} • #${sessionFingerprintRef.current}`;

  // Build a grid of watermark tiles
  const COLS = 4;
  const ROWS = 6;
  const tiles = Array.from({ length: COLS * ROWS });

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        pointerEvents: 'none',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: `repeat(${COLS}, 1fr)`,
        gridTemplateRows: `repeat(${ROWS}, 1fr)`,
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {tiles.map((_, i) => {
        // Slight random-ish offset per tile for harder DOM removal
        const offsetX = ((i * 7) % 20) - 10;
        const offsetY = ((i * 13) % 20) - 10;
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: `rotate(-30deg) translate(${offsetX}px, ${offsetY}px)`,
              opacity: 0.07,
              padding: '8px',
            }}
          >
            <span
              style={{
                color: '#ffffff',
                fontSize: '11px',
                fontFamily: 'monospace',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                letterSpacing: '0.04em',
                textShadow: '0 0 2px rgba(0,0,0,0.8)',
              }}
            >
              {watermarkText}
            </span>
          </div>
        );
      })}
    </div>
  );
}
