import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type AdSenseAdProps = {
  clientId: string;
  slotId: string;
  className?: string;
};

function ensureAdSenseScript(clientId: string) {
  if (document.querySelector('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]')) {
    return;
  }

  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
  document.head.appendChild(script);
}

export function AdSenseAd({ clientId, slotId, className }: AdSenseAdProps) {
  const pushedRef = useRef(false);

  useEffect(() => {
    ensureAdSenseScript(clientId);
  }, [clientId]);

  useEffect(() => {
    if (pushedRef.current) return;

    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
      pushedRef.current = true;
    } catch (error) {
      console.warn("[adsense] failed to push ad", error);
    }
  }, []);

  return (
    <div className={className}>
      <p className="mb-2 text-center text-xs font-semibold text-ink/45">
        Publicidade
      </p>
      <ins
        className="adsbygoogle block min-h-24 w-full overflow-hidden rounded-xl bg-white/70"
        style={{ display: "block" }}
        data-ad-client={clientId}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
