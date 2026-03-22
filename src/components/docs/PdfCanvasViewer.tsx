'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  blobUrl: string;
}

export default function PdfCanvasViewer({ blobUrl }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfRef = useRef<any>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Dynamically import to avoid SSR issues
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

        const pdf = await pdfjsLib.getDocument({ url: blobUrl, disableStream: true, disableAutoFetch: true }).promise;
        if (cancelled) return;
        pdfRef.current = pdf;
        setNumPages(pdf.numPages);
        setCurrentPage(1);
      } catch (e) {
        if (!cancelled) setError(`Failed to load PDF: ${e instanceof Error ? e.message : String(e)}`);
        console.error('PDF load error:', e);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [blobUrl]);

  useEffect(() => {
    if (!pdfRef.current || !containerRef.current) return;

    let cancelled = false;

    async function renderPage() {
      try {
        // Cancel any in-progress render
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
          renderTaskRef.current = null;
        }

        const page = await pdfRef.current.getPage(currentPage);
        if (cancelled) return;

        const container = containerRef.current!;
        const containerWidth = container.clientWidth || 800;
        const viewport = page.getViewport({ scale: 1 });
        const scale = containerWidth / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        // Reuse or create canvas
        let canvas = container.querySelector('canvas') as HTMLCanvasElement | null;
        if (!canvas) {
          canvas = document.createElement('canvas');
          canvas.style.display = 'block';
          canvas.style.width = '100%';
          canvas.style.userSelect = 'none';
          container.appendChild(canvas);
        }

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        const ctx = canvas.getContext('2d')!;
        const task = page.render({ canvasContext: ctx, viewport: scaledViewport });
        renderTaskRef.current = task;
        await task.promise;
        renderTaskRef.current = null;
      } catch (e: unknown) {
        // RenderingCancelledException is expected on fast page changes
        if (e instanceof Error && e.name !== 'RenderingCancelledException') {
          console.error(e);
        }
      }
    }

    renderPage();
    return () => { cancelled = true; };
  }, [currentPage, numPages]);

  if (error) return <p className="text-red-400 text-sm p-4">{error}</p>;
  if (!numPages) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-3 p-4">
      {/* Canvas render target */}
      <div
        ref={containerRef}
        className="w-full bg-white rounded shadow-lg overflow-hidden"
        onContextMenu={(e) => e.preventDefault()}
        style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
      />

      {/* Page controls */}
      {numPages > 1 && (
        <div className="flex items-center gap-3 text-sm text-gray-300">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span>{currentPage} / {numPages}</span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
            disabled={currentPage === numPages}
            className="p-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
