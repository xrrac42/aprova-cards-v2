import { Component, ErrorInfo, ReactNode } from 'react';

// Errors caused by browser extensions manipulating the DOM — not app bugs
const IGNORABLE_PATTERNS = [
  'insertBefore',
  'removeChild',
  'appendChild',
  'NotFoundError',
  'The node before which the new node',
];

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State | null {
    // Don't catch DOM errors from browser extensions
    const msg = error?.message || '';
    if (IGNORABLE_PATTERNS.some(p => msg.includes(p))) {
      console.warn('[ErrorBoundary] Ignoring browser-extension DOM error:', msg);
      return null; // don't update state — let the app continue
    }
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary capturou:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          height: '100vh', gap: 16, padding: 24,
          fontFamily: 'sans-serif',
        }}>
          <h2>Algo deu errado</h2>
          <button onClick={() => this.setState({ hasError: false })}>
            Tentar novamente
          </button>
          <button onClick={() => { window.location.href = '/'; }}>
            Voltar ao início
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
