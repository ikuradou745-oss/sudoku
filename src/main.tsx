import { Component, ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: unknown) {
    console.error('App Crashed with error:', error, errorInfo);
  }

  handleReload = () => {
    try {
      localStorage.removeItem('uolingo_user_stats_v2');
    } catch {
      // ignore
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FFFFFF] flex items-center justify-center p-6 text-[#4B4B4B]">
          <div className="max-w-md w-full p-6 rounded-3xl border-2 border-[#FFD0D0] bg-[#FFF5F5] text-center shadow-lg space-y-4">
            <div className="text-4xl">🦉💥</div>
            <h2 className="text-xl font-black text-[#FF4B4B]">画面の読み込みでエラーが発生しました</h2>
            <p className="text-xs font-bold text-[#777777]">
              一時的なデータ不整合の可能性があります。下のボタンを押して再読み込みしてください。
            </p>
            {this.state.error && (
              <pre className="p-3 bg-white border border-[#FFD0D0] rounded-xl text-[11px] text-[#FF4B4B] text-left overflow-x-auto font-mono max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleReload}
              className="duo-btn duo-btn-green w-full py-3.5 rounded-2xl text-sm font-black flex items-center justify-center cursor-pointer shadow-md"
            >
              データをリフレッシュして再読み込み
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
}
