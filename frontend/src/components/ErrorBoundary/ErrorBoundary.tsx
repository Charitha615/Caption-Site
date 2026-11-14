import React from 'react';
import { ErrorState } from '../ErrorState/ErrorState';

interface Props {
  children: React.ReactNode;
  /** Changing this key (e.g. the route path) clears a previous error. */
  resetKey?: string;
  fullScreen?: boolean;
}

interface State {
  error: Error | null;
  resetKey?: string;
}

/**
 * Catches render errors so one broken screen never blanks the whole app.
 * Users see a friendly message; details stay in the console in development only.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  /** Navigating elsewhere (new resetKey) clears a previous error. */
  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null;
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('Render error:', error, info.componentStack);
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div style={this.props.fullScreen ? { minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg-main)' } : { padding: '48px 16px' }}>
        <ErrorState
          title="Something went wrong"
          message="This screen failed to load. Your work is saved on the server — reload to continue."
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }
}
