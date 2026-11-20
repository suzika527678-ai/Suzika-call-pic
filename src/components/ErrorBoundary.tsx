import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleResetAndReload = () => {
    try {
      localStorage.removeItem('zuzika_profile_v1');
      localStorage.removeItem('zuzika_photos_v4');
      localStorage.removeItem('zuzika_videos_v4');
      localStorage.removeItem('zuzika_photos_v1');
      localStorage.removeItem('zuzika_videos_v1');
      localStorage.removeItem('zuzika_comments_v1');
      localStorage.removeItem('zuzika_messages_v1');
      localStorage.removeItem('zuzika_banner_config_v1');
      if (typeof window !== 'undefined' && window.indexedDB) {
        window.indexedDB.deleteDatabase('zuzika_persistent_db_v2');
        window.indexedDB.deleteDatabase('zuzika_persistent_db_v1');
        window.indexedDB.deleteDatabase('zuzika_persistent_db');
      }
    } catch {
      // ignore
    }
    window.location.reload();
  };

  private handleSimpleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#080a12] text-white flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#111524] border border-[#ff35bb]/40 rounded-3xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold font-display text-white">অ্যাপ লোড করতে সমস্যা হয়েছে</h2>
              <p className="text-xs text-[#9da4b8]">
                একটি অপ্রত্যাশিত সমস্যা হয়েছিল। নিচের বাটনে ক্লিক করে অ্যাপটি রিলোড বা ক্যাশ ক্লিয়ার করুন।
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 rounded-xl bg-black/60 border border-white/10 text-left font-mono text-[11px] text-red-300 max-h-32 overflow-y-auto">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleSimpleReload}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white text-xs font-bold flex items-center justify-center gap-2 hover:opacity-95 active:scale-95 transition-all shadow-lg shadow-[#ff35bb]/20"
              >
                <RefreshCw className="w-4 h-4" />
                <span>পুনরায় লোড করুন (Reload App)</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetAndReload}
                className="w-full py-2.5 rounded-xl bg-[#1d2238] hover:bg-[#272e4c] text-[#00d2ff] text-xs font-bold border border-[#00d2ff]/30 flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <Trash2 className="w-4 h-4 text-amber-400" />
                <span>ক্যাশ রিসেট ও ফ্রেশ স্টার্ট (Clear Cache & Recover)</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
