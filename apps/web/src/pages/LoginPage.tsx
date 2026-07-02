import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, isNetworkFailure } from "../lib/api";
import { useAuth } from "../lib/auth";
import { LandingPage } from "./LandingPage";

const HOME_ROUTE = "/app/home";
const GOOGLE_SCRIPT_ID = "google-identity-services";
const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
let googleIdentityScriptPromise: Promise<void> | null = null;

function loadGoogleIdentityScript() {
  if (googleIdentityScriptPromise) return googleIdentityScriptPromise;

  googleIdentityScriptPromise = new Promise<void>((resolve, reject) => {
    if (window.google?.accounts.id) {
      resolve();
      return;
    }

    const existingScript = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      if (existingScript.dataset.ready === "true" || existingScript.dataset.loaded === "true") {
        waitForGoogleIdentityApi().then(resolve).catch(reject);
        return;
      }
      existingScript.addEventListener("load", () => waitForGoogleIdentityApi().then(resolve).catch(reject), { once: true });
      existingScript.addEventListener(
        "error",
        () => {
          existingScript.remove();
          reject(new Error("Google Identity script failed to load."));
        },
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      waitForGoogleIdentityApi()
        .then(() => {
          script.dataset.ready = "true";
          resolve();
        })
        .catch(reject);
    };
    script.onerror = () => {
      script.remove();
      reject(new Error("Google Identity script failed to load."));
    };
    document.head.appendChild(script);
  }).catch((error) => {
    googleIdentityScriptPromise = null;
    if (!window.google?.accounts.id) {
      document.getElementById(GOOGLE_SCRIPT_ID)?.remove();
    }
    throw error;
  });

  return googleIdentityScriptPromise;
}

function waitForGoogleIdentityApi(timeoutMs = 5_000) {
  return new Promise<void>((resolve, reject) => {
    const startedAt = Date.now();
    const check = () => {
      if (window.google?.accounts.id) {
        resolve();
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error("Google Identity script loaded without API."));
        return;
      }
      window.setTimeout(check, 50);
    };
    check();
  });
}

export function LoginPage() {
  const { loginWithGoogleToken } = useAuth();
  const navigate = useNavigate();
  const signupButtonRef = useRef<HTMLDivElement | null>(null);
  const signinButtonRef = useRef<HTMLDivElement | null>(null);
  const loginPendingRef = useRef(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [googleScriptError, setGoogleScriptError] = useState<string | null>(null);
  const [loginPending, setLoginPending] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  useEffect(() => {
    if (!clientId || (!signupButtonRef.current && !signinButtonRef.current)) return;
    let cancelled = false;

    const renderGoogleButtons = () => {
      if (cancelled) return;
      setGoogleScriptError(null);
      window.google?.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: { credential: string }) => {
          if (!response.credential || loginPendingRef.current) return;

          loginPendingRef.current = true;
          setLoginPending(true);
          setLoginError(null);
          try {
            await loginWithGoogleToken(response.credential);
            navigate(HOME_ROUTE, { replace: true });
          } catch (error) {
            setLoginError(loginErrorMessage(error));
          } finally {
            loginPendingRef.current = false;
            setLoginPending(false);
          }
        },
      });

      const renderGoogleButton = (
        element: HTMLElement | null,
        text: "signin_with" | "signup_with",
        width: number,
      ) => {
        if (!element) return;
        element.innerHTML = "";
        window.google?.accounts.id.renderButton(element, {
          type: "standard",
          theme: "outline",
          size: "medium",
          text,
          shape: "pill",
          logo_alignment: "left",
          width,
          locale: "pt_BR",
        });
      };

      renderGoogleButton(signinButtonRef.current, "signin_with", 198);
      renderGoogleButton(signupButtonRef.current, "signup_with", 260);
      setGoogleReady(true);
    };

    setGoogleReady(false);
    setGoogleScriptError(null);
    void loadGoogleIdentityScript()
      .then(renderGoogleButtons)
      .catch(() => {
        if (!cancelled) {
          setGoogleReady(false);
          setGoogleScriptError("Nao foi possivel carregar o login do Google. Verifique a conexao e recarregue a pagina.");
        }
      });

    return () => {
      cancelled = true;
      signinButtonRef.current?.replaceChildren();
      signupButtonRef.current?.replaceChildren();
    };
  }, [clientId, loginWithGoogleToken, navigate]);

  return (
    <LandingPage
      clientId={clientId}
      signinButtonRef={signinButtonRef}
      signupButtonRef={signupButtonRef}
      googleReady={googleReady}
      loginPending={loginPending}
      authError={loginError ?? googleScriptError}
    />
  );
}

function loginErrorMessage(error: unknown) {
  if (isNetworkFailure(error)) {
    return "Nao foi possivel conectar ao servidor. Verifique sua internet e tente novamente.";
  }

  if (error instanceof ApiError && error.status >= 500) {
    return "O login esta instavel no momento. Tente novamente em alguns segundos.";
  }

  return "Nao foi possivel entrar com Google. Tente novamente.";
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (
            element: HTMLElement | null,
            options: {
              type?: "standard" | "icon";
              theme?: string;
              size?: string;
              shape?: string;
              text?: string;
              logo_alignment?: string;
              width?: number;
              locale?: string;
            },
          ) => void;
        };
      };
    };
  }
}
