// frontend\src\context\LoadingModalContext.jsx

import { createContext, useContext, useState, useCallback, useRef } from "react";
import { Loader2 } from "lucide-react";

const LoadingModalContext = createContext(null);

export function LoadingModalProvider({ children }) {
  const [message, setMessage] = useState(null);
  // supports nested/overlapping calls (e.g. two async actions in flight) without
  // one finishing early and hiding the modal out from under the other
  const depthRef = useRef(0);

  const showLoading = useCallback((text = "Loading...") => {
    depthRef.current += 1;
    setMessage(text);
  }, []);

  const hideLoading = useCallback(() => {
    depthRef.current = Math.max(0, depthRef.current - 1);
    if (depthRef.current === 0) {
      setMessage(null);
    }
  }, []);

  // convenience wrapper: runWithLoading("Saving user...", () => api.createUser(data))
  const runWithLoading = useCallback(
    async (text, fn) => {
      showLoading(text);
      try {
        return await fn();
      } finally {
        hideLoading();
      }
    },
    [showLoading, hideLoading]
  );

  return (
    <LoadingModalContext.Provider value={{ showLoading, hideLoading, runWithLoading }}>
      {children}
      {message !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-xl border bg-card px-8 py-6 shadow-lg">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
        </div>
      )}
    </LoadingModalContext.Provider>
  );
}

export function useLoadingModal() {
  const ctx = useContext(LoadingModalContext);
  if (!ctx) {
    throw new Error("useLoadingModal must be used within a LoadingModalProvider");
  }
  return ctx;
}