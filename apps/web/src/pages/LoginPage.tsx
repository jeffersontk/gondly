import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { LandingPage } from "./LandingPage";

const HOME_ROUTE = "/app/home";

export function LoginPage() {
  const { loginWithGoogleToken } = useAuth();
  const navigate = useNavigate();
  const signupButtonRef = useRef<HTMLDivElement | null>(null);
  const signinButtonRef = useRef<HTMLDivElement | null>(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  useEffect(() => {
    if (!clientId || (!signupButtonRef.current && !signinButtonRef.current)) return;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
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
    document.head.appendChild(script);
    return () => {
      script.remove();
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
