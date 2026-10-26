import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom";
import { LandingPage } from "../pages/LandingPage";
import { PrivacyPage, TermsPage, ContactPage } from "../pages/PublicInfoPages";

export function renderMarketingPage(path: string, clientId?: string) {
  const pages = { "/privacy": <PrivacyPage />, "/terms": <TermsPage />, "/contact": <ContactPage /> };
  return renderToString(
    <StaticRouter location={path}>
      {path === "/" ? <LandingPage clientId={clientId} signinButtonRef={{ current: null }} signupButtonRef={{ current: null }} /> : pages[path as keyof typeof pages]}
    </StaticRouter>,
  );
}
