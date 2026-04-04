"use client";

import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-6 py-12 text-center"
    >
      <AlertCircle
        className="h-8 w-8 text-red-500 dark:text-red-400 mb-3"
        aria-hidden
      />
      <p className="text-sm font-medium text-red-700 dark:text-red-400 max-w-sm">
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Try again
        </button>
      )}
    </div>
  );
}
