import { isEditorialPath } from "./editorial/catalog.mjs";
import "./styles.css";
import { registerServiceWorker } from "./lib/register-sw";

registerServiceWorker();

if (isEditorialPath(window.location.pathname)) {
  void import("./editorial/public-main");
} else {
  void import("./app-main");
}
