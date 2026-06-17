import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { AdProvider } from "./lib/ads";
import { AuthProvider } from "./lib/auth";
import { queryClient } from "./lib/queryClient";
import { registerServiceWorker } from "./lib/register-sw";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AdProvider>
            <App />
          </AdProvider>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);

registerServiceWorker();
