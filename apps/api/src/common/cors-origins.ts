const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "https://gondly-web.vercel.app",
  "https://gondly.com.br",
  "https://www.gondly.com.br",
];

export function buildAllowedOrigins(...values: Array<string | undefined | null>) {
  const origins = new Set<string>();

  for (const value of [...DEFAULT_ALLOWED_ORIGINS, ...values]) {
    for (const origin of splitOrigins(value)) {
      addOriginWithAliases(origins, origin);
    }
  }

  return [...origins];
}

export function isAllowedOrigin(origin: string | undefined, allowedOrigins: string[]) {
  if (!origin) return true;
  return allowedOrigins.includes(normalizeOrigin(origin));
}

function splitOrigins(value: string | undefined | null) {
  return (value ?? "")
    .split(",")
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);
}

function addOriginWithAliases(origins: Set<string>, origin: string) {
  origins.add(origin);

  try {
    const url = new URL(origin);
    if (url.hostname.startsWith("www.")) {
      url.hostname = url.hostname.replace(/^www\./, "");
      origins.add(url.origin);
      return;
    }

    if (!url.hostname.includes("localhost") && !url.hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
      url.hostname = `www.${url.hostname}`;
      origins.add(url.origin);
    }
  } catch {
    // Invalid origins are ignored after the literal normalized value is added.
  }
}

function normalizeOrigin(origin: string) {
  const normalized = origin.trim().replace(/\/+$/, "");
  try {
    return new URL(normalized).origin;
  } catch {
    return normalized;
  }
}
