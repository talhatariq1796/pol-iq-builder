import React from 'react';

interface KeplerErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface KeplerErrorBoundaryProps {
  children: React.ReactNode;
  onError?: (error: Error) => void;
}

export class KeplerErrorBoundary extends React.Component<KeplerErrorBoundaryProps, KeplerErrorBoundaryState> {
  constructor(props: KeplerErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): KeplerErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[KeplerErrorBoundary] Caught error:', error, errorInfo);
    
    // Call onError callback if provided
    if (this.props.onError) {
      this.props.onError(error);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full bg-red-50 flex items-center justify-center border border-red-200">
          <div className="text-center p-4">
            <div className="text-red-600 mb-2">⚠️ Kepler.gl Error</div>
            <p className="text-sm text-red-500 mb-3">
              {this.state.error?.message || 'Failed to load Kepler.gl visualization'}
            </p>
            <button 
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default KeplerErrorBoundary; 