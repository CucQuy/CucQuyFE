import React from "react";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./config/queryClient";
import { LanguageProvider } from "./contexts/LanguageContext";
import { AuthProvider } from "./contexts/AuthContext";
import { ScreenConfigProvider } from "./contexts/ScreenConfigContext";
import { useOfflineDetector } from "./hooks/useOfflineDetector";
import AppRoutes from "./AppRoutes";
import RealtimePaymentListener from "./components/RealtimePaymentListener";
import ServiceWorkerUpdater from "./components/ServiceWorkerUpdater";
import { Toaster } from "react-hot-toast";

// Devtools chỉ bật ở dev — lazy + ((import.meta as any).env?.DEV) để Vite tree-shake khỏi bundle prod.
const ReactQueryDevtools = ((import.meta as any).env?.DEV)
  ? React.lazy(() =>
      import("@tanstack/react-query-devtools").then((m) => ({
        default: m.ReactQueryDevtools,
      }))
    )
  : () => null;

const App: React.FC = () => {
  const isOffline = useOfflineDetector();
  if (isOffline) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
      <ServiceWorkerUpdater />
      <AuthProvider>
        <ScreenConfigProvider>
          <LanguageProvider>
            <RealtimePaymentListener />
            <AppRoutes />
          </LanguageProvider>
        </ScreenConfigProvider>
      </AuthProvider>
      <Toaster
        position="top-right"
        reverseOrder={false}
        toastOptions={{
          duration: 3000,
          className: "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 shadow-lg rounded-xl text-sm px-4 py-3",
          iconTheme: { primary: "#4abab9", secondary: "#ffffff" },
          success: { iconTheme: { primary: "#16a34a", secondary: "#ffffff" } },
          error: { iconTheme: { primary: "#dc2626", secondary: "#ffffff" } },
        }}
      />
      </BrowserRouter>
      {((import.meta as any).env?.DEV) && (
        <React.Suspense fallback={null}>
          <ReactQueryDevtools initialIsOpen={false} />
        </React.Suspense>
      )}
    </QueryClientProvider>
  );
};

export default App;
