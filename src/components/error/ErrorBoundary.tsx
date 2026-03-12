'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 Error Boundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Log error to external service in production
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to error reporting service
      console.error('Production error:', {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error!} retry={this.handleRetry} />;
      }

      return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md w-full text-center">
            <div className="text-red-400 mb-4">
              <AlertTriangle className="w-12 h-12 mx-auto" />
            </div>
            
            <h1 className="text-xl font-semibold text-gray-100 mb-2">
              Something went wrong
            </h1>
            
            <p className="text-gray-400 mb-6">
              An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-4 mb-6 text-left">
                <div className="text-red-400 font-mono text-sm">
                  <div className="font-bold mb-2">Error:</div>
                  <div className="mb-2">{this.state.error.message}</div>
                  {this.state.error.stack && (
                    <>
                      <div className="font-bold mb-2">Stack:</div>
                      <pre className="text-xs overflow-auto max-h-32">
                        {this.state.error.stack}
                      </pre>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Page
              </button>
              
              <button
                onClick={this.handleRetry}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;