"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Optional heading shown in the fallback UI. */
  heading?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * React error boundary that catches runtime errors in its subtree and renders
 * a friendly fallback instead of an empty / broken page.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomePageThatMightCrash />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: { componentStack: string }) {
    // In production you would send this to an error-reporting service.
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, message: "" });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center min-h-[40vh] gap-4 px-6 py-12 text-center"
      >
        <div className="rounded-full bg-red-50 dark:bg-red-900/20 p-4">
          <AlertTriangle
            className="h-8 w-8 text-red-500 dark:text-red-400"
            aria-hidden
          />
        </div>
        <div className="max-w-md space-y-1">
          <p className="text-base font-semibold text-gray-900 dark:text-gray-50">
            {this.props.heading ?? "Something went wrong"}
          </p>
          {this.state.message && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {this.state.message}
            </p>
          )}
        </div>
        <button
          onClick={this.handleReset}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Try again
        </button>
      </div>
    );
  }
}
