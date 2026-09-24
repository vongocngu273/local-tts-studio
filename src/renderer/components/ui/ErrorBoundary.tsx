import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center bg-background p-8 text-foreground">
          <div className="flex max-w-md flex-col items-center rounded-xl border border-border bg-card p-8 text-center shadow-lg">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-red-500">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <h1 className="mb-2 text-xl font-semibold">Đã xảy ra sự cố (Something went wrong)</h1>
            <p className="mb-6 text-sm text-muted-foreground">
              Đã xảy ra lỗi không mong muốn trong giao diện ứng dụng. Bạn có thể thử khởi động lại giao diện.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <pre className="mb-6 max-h-36 w-full overflow-auto rounded bg-muted p-3 text-left font-mono text-xs text-muted-foreground">
                {this.state.error.message}
              </pre>
            )}

            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <RefreshCw className="h-4 w-4" />
              Khởi động lại ứng dụng
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
