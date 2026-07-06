import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Popup-level error boundary. The extension popup is a tiny surface —
 * a single React throw would leave the user staring at a blank window
 * with no way to recover. Catch, show a compact message, and give them
 * a "Reload" button that closes+reopens the popup.
 */
export class PopupErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Best-effort: dev consoles will show it. We deliberately don't
    // ship telemetry from the popup — nothing about the vault leaves
    // the device.
    console.error("[aegis-popup] boundary caught", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="wrap">
        <div className="headline">
          <h1>Something broke</h1>
          <p className="sub">
            The popup hit an unexpected error. Close and reopen the popup, or
            reload the extension from{" "}
            <code>chrome://extensions</code>.
          </p>
        </div>
        <div className="status warn">
          <span className="dot" />
          {this.state.error.message.slice(0, 120) || "Unknown error"}
        </div>
        <button className="btn block" onClick={() => window.close()}>
          Close
        </button>
      </div>
    );
  }
}
