import React from 'react';
import { ShieldAlert, RefreshCw, LogOut, Terminal } from 'lucide-react';

export interface AdminErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

export interface AdminErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class AdminErrorBoundary extends React.Component<AdminErrorBoundaryProps, AdminErrorBoundaryState> {
  public override state: AdminErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): AdminErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  public override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 [AdminErrorBoundary] Caught unhandled Admin Panel Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  private handleReturnToLogin = () => {
    try {
      sessionStorage.removeItem('pb_admin_secure_session');
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined') {
      window.location.href = '/adminbank';
    }
  };

  public override render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || 'An unexpected runtime error occurred in the Admin Terminal.';
      const stack = this.state.error?.stack || this.state.errorInfo?.componentStack || '';

      return (
        <div className="min-h-screen w-full bg-[#0d1117] text-white flex flex-col justify-center items-center p-4 selection:bg-[#FF6000] selection:text-white">
          <div className="fixed inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-red-600/10 blur-[120px] rounded-full" />
          </div>

          <div className="relative w-full max-w-lg bg-[#161b22] border border-red-800/60 rounded-2xl p-7 shadow-2xl backdrop-blur-md">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-red-950/80 border border-red-800/80 flex items-center justify-center shadow-lg shadow-red-950/40 mb-3.5 text-red-400">
                <ShieldAlert className="w-9 h-9" />
              </div>
              <h1 className="text-xl font-black tracking-tight text-white">
                Admin Panel encountered an error.
              </h1>
              <p className="text-gray-400 text-xs mt-1">
                The terminal caught an isolated component exception without affecting normal user traffic.
              </p>
            </div>

            <div className="mb-5 p-3.5 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs">
              <div className="font-semibold text-red-200 mb-1 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-red-400" />
                <span>Error Diagnosis:</span>
              </div>
              <div className="font-mono text-[11.5px] break-words">{errorMessage}</div>
            </div>

            {stack && (
              <details className="mb-6 group">
                <summary className="text-[11px] text-gray-500 hover:text-gray-300 cursor-pointer select-none font-medium mb-1">
                  View Technical Stack Trace
                </summary>
                <pre className="p-3 bg-[#0d1117] rounded-xl border border-gray-800 text-[10px] text-gray-400 overflow-x-auto max-h-40 font-mono">
                  {stack}
                </pre>
              </details>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={this.handleReload}
                className="flex-1 py-3 px-4 rounded-xl bg-[#FF6000] hover:bg-[#E65100] active:scale-[0.98] text-white font-bold text-xs tracking-wide shadow-lg shadow-orange-950/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload</span>
              </button>

              <button
                onClick={this.handleReturnToLogin}
                className="flex-1 py-3 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 active:scale-[0.98] text-gray-200 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Return to Admin Login</span>
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-800 text-center">
              <p className="text-[10px] text-gray-500">
                Endpoint: <span className="font-mono text-gray-400">/adminbank</span> &bull; Status: Guarded
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
