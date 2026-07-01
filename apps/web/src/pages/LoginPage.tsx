import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { LandingPage } from "./LandingPage";

const HOME_ROUTE = "/app/home";
const GOOGLE_SCRIPT_ID = "google-identity-services";
const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

function loadGoogleIdentityScript() {
  return new Promise<void>((resolve, reject) => {
    if (window.google?.accounts.id) {
      resolve();
      return;
    }

    const existingScript = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      if (existingScript.dataset.ready === "true") {
        reject(new Error("Google Identity script loaded without API."));
        return;
      }
      existingScript.addEventListener("load", () => resolve(), { once: true });
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
      script.dataset.ready = "true";
      resolve();
    };
    script.onerror = () => {
      script.remove();
      reject(new Error("Google Identity script failed to load."));
    };
    document.head.appendChild(script);
  });
}

export function LoginPage() {
  const { loginWithGoogleToken } = useAuth();
  const navigate = useNavigate();
  const signupButtonRef = useRef<HTMLDivElement | null>(null);
  const signinButtonRef = useRef<HTMLDivElement | null>(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  useEffect(() => {
    if (!clientId || (!signupButtonRef.current && !signinButtonRef.current)) return;
    let cancelled = false;

    const renderGoogleButtons = () => {
      if (cancelled) return;
      window.google?.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: { credential: string }) => {
          await loginWithGoogleToken(response.credential);
          navigate(HOME_ROUTE, { replace: true });
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
    };

    void loadGoogleIdentityScript().then(renderGoogleButtons).catch(() => undefined);

    return () => {
      cancelled = true;
      signinButtonRef.current?.replaceChildren();
      signupButtonRef.current?.replaceChildren();
    };
  }, [clientId, loginWithGoogleToken, navigate]);

  return <LandingPage clientId={clientId} signinButtonRef={signinButtonRef} signupButtonRef={signupButtonRef} />;
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
