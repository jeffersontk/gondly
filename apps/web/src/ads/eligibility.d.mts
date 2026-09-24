export function canShowAd(input: {
  enabled: boolean;
  hasNoAds: boolean;
  loading: boolean;
  error?: boolean;
  hasContent: boolean;
  pathname: string;
  slot: string;
  published?: boolean;
}): boolean;
