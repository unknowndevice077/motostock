"use client";

import React from "react";

interface State {
  error: Error | null;
}

/**
 * Catches render/lifecycle errors anywhere below it and shows the actual
 * error instead of leaving the screen blank or "stuck" — a plain React
 * exception has no default UI, so without this a bug can look like a hang.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("MotoStock crashed:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-sans">
          <div className="max-w-lg w-full bg-slate-900 border border-red-900/40 rounded-xl p-6 space-y-3">
            <p className="text-sm font-semibold text-red-400">Something went wrong</p>
            <p className="text-xs text-slate-400 leading-relaxed break-words">{this.state.error.message}</p>
            <pre className="text-[10px] text-slate-600 overflow-x-auto max-h-40 whitespace-pre-wrap">{this.state.error.stack}</pre>
            <button
              onClick={() => this.setState({ error: null })}
              className="text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
