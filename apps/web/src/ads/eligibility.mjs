const routes = {
  home_inline: [],
  lists_inline: [],
  history_inline: [],
  compare_inline: [],
  landing_inline: [],
};
export function canShowAd({
  enabled,
  hasNoAds,
  loading,
  error,
  hasContent,
  pathname,
  slot,
  published = false,
}) {
  if (!enabled || hasNoAds || loading || error || !hasContent) return false;
  if (slot === "article_inline")
    return published && /^\/blog\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pathname);
  return routes[slot]?.includes(pathname) ?? false;
}
