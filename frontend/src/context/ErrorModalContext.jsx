// frontend\src\context\ErrorModalContext.jsx

import { createContext, useContext, useState } from "react";
import { ErrorModal } from "@/components/ErrorModal";

const ErrorModalContext = createContext(null);

export function ErrorModalProvider({ children }) {
  const [error, setError] = useState(null); // { title, message } | null

  const showError = (message, title = "Something went wrong") => {
    setError({ title, message });
  };

  const closeError = () => setError(null);

  return (
    <ErrorModalContext.Provider value={{ showError }}>
      {children}
      <ErrorModal
        open={!!error}
        title={error?.title}
        message={error?.message}
        onClose={closeError}
      />
    </ErrorModalContext.Provider>
  );
}

export function useErrorModal() {
  const ctx = useContext(ErrorModalContext);
  if (!ctx) {
    throw new Error("useErrorModal must be used inside an ErrorModalProvider");
  }
  return ctx;
}