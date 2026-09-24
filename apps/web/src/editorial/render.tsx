import { renderToString } from "react-dom/server";
import { PublicSite } from "./PublicSite";
import type { Article } from "./types";
export { pageMeta } from "./PublicSite";
export function renderPublic(path: string, items?: Article[]) {
  return renderToString(<PublicSite path={path} items={items} />);
}
