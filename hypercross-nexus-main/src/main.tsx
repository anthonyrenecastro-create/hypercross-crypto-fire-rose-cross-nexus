import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "./wagmi";
import App from "./App.tsx";
import "./index.css";

const queryClient = new QueryClient();

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  private readonly children: ReactNode;
  state: { error: Error | null } = { error: null };

  constructor(props: { children: ReactNode }) {
    super(props);
    this.children = props.children;
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Application render failed", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <main style={{ minHeight: "100vh", padding: "32px", background: "#050505", color: "#fff", fontFamily: "sans-serif" }}>
          <h1 style={{ fontSize: "24px", marginBottom: "12px" }}>Hyper-Cross Nexus could not load</h1>
          <p style={{ color: "#fca5a5", marginBottom: "16px" }}>{this.state.error.message}</p>
          <button type="button" onClick={() => window.location.reload()} style={{ padding: "10px 16px", color: "#fff", background: "#1500ff", border: 0, borderRadius: "6px", cursor: "pointer" }}>
            Reload application
          </button>
        </main>
      );
    }
    return this.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </WagmiProvider>
    </AppErrorBoundary>
  </StrictMode>
);

