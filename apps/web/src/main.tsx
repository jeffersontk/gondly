import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { ErrorBoundary } from "./ErrorBoundary";
import { AdProvider } from "./lib/ads";
import { AuthProvider } from "./lib/auth";
import { installOfflineQueueSync } from "./lib/offlineQueue";
import { initPwaInstall } from "./lib/pwaInstall";
import { installBackgroundQuerySync, installQueryCachePersistence, queryClient, restorePersistedQueryCache } from "./lib/queryClient";
import { registerServiceWorker } from "./lib/register-sw";
import "./styles.css";

async function bootstrap() {
  await restorePersistedQueryCache();
  installQueryCachePersistence();
  installBackgroundQuerySync();
  installOfflineQueueSync();
  initPwaInstall();

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <AdProvider>
              <ErrorBoundary>
                <App />
              </ErrorBoundary>
            </AdProvider>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </StrictMode>,
  );

  registerServiceWorker();
}

void bootstrap();
