import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error("[RouteErrorBoundary]", error);
  }

  handleReload = () => {
    try {
      sessionStorage.removeItem("lovable:chunk-reloaded");
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="cyber-card rounded-xl p-8 max-w-md w-full text-center space-y-4">
            <h2 className="text-xl font-display font-bold text-foreground">
              Something went wrong
            </h2>
            <p className="text-sm text-muted-foreground">
              We couldn't load this page. This is usually a temporary network issue.
            </p>
            <Button onClick={this.handleReload} className="glow-btn">
              Reload page
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
