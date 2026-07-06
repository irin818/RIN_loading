import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallbackLabel?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ArchiveErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Archive] render error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="archive-layout">
          <div className="archive-page">
            <div className="archive-page-head">
              <h1 className="archive-page-title">Archive Error</h1>
              <p className="archive-page-subtitle">
                Something went wrong in this archive section.
              </p>
            </div>
            <div className="archive-page-body">
              <p className="archive-status archive-status-error">
                {this.state.error?.message || "Unknown render error"}
              </p>
              <button
                className="archive-btn"
                type="button"
                onClick={() => this.setState({ hasError: false, error: null })}
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
