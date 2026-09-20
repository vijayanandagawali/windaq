"use client";

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[WinDaq AppShell ErrorBoundary]:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center bg-[#070a14] text-white">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-6 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
            <AlertTriangle size={36} />
          </div>
          <h2 className="text-2xl font-black uppercase tracking-wider mb-2">Something went wrong</h2>
          <p className="text-gray-400 text-xs sm:text-sm max-w-md mb-6">
            An unexpected error occurred in this view. Our high-availability engine has isolated the issue so your wallet balance remains completely safe.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={this.handleReset}
              className="px-5 py-2.5 rounded-xl bg-neon-mint text-deep-ocean font-extrabold text-xs flex items-center gap-2 shadow-[0_0_15px_rgba(0,255,163,0.3)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <RefreshCw size={14} />
              Reload Page
            </button>
            <Link
              href="/"
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-extrabold text-xs flex items-center gap-2 hover:bg-white/10 active:scale-95 transition-all"
            >
              <Home size={14} />
              Return to Lobby
            </Link>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
