# Gondly Analytics Events

Tracking is sent through Google Tag Manager with `window.dataLayer.push`.

Analytics is enabled only when `VITE_ENABLE_ANALYTICS=true`. When `VITE_DEBUG_ANALYTICS=true`, events are logged to the browser console. Events must not include PII or free-form user content.

## Privacy Rules

- Do not send `email`, `name`, `phone`, `cpf`, `document`, `address`, tokens, passwords, notes, observations, descriptions, product names, list names, market names, or other free text.
- `safeAnalyticsParams` removes sensitive keys and nullish values before pushing to `dataLayer`.
- Search sends `search_term` only when the term is short and safe; otherwise it sends only `search_length` and `context`.
- Category is sanitized and length-limited before being sent.

## Suggested GA4 Conversions

- `sign_up`
- `create_list`
- `start_purchase`
- `finish_purchase`
- `begin_remove_ads_checkout`
- `remove_ads_purchase_success`

## Events

| Event | When it fires | Parameters | Conversion | Privacy notes |
| --- | --- | --- | --- | --- |
| `page_view` | SPA route changes | `page_path`, `page_title`, `app_area` | No | No user identity. |
| `view_landing` | Landing renders | `source` | No | No user identity. |
| `click_cta_access_app` | Google CTA click on landing | `source`, `method` | No | No Google payload is sent. |
| `login` | Successful auth response | `method` | No | No token, email, or name. |
| `sign_up` | Successful auth response for new user | `method` | Yes | Depends on backend `isNewUser`; no user identity. |
| `click_create_list_shortcut` | Home or list shortcut click | `source` | No | Intent event only. |
| `click_compare_shortcut` | Compare shortcut click | `source` | No | Intent event only. |
| `create_list` | List creation succeeds | `list_id`, `items_count`, `source` | Yes | No list name or description. |
| `add_item_to_list` | Item add/import to list succeeds | `list_id`, `items_count`, `source`, `category`, `unit`, `quantity` | No | No product name or notes. |
| `duplicate_list` | List duplicate succeeds | `list_id`, `items_count`, `source` | No | Uses original list id only. |
| `share_list` | Share link is created | `list_id`, `method`, `source` | No | No URL, email, or member identity. |
| `accept_list_invite` | Shared-list access is accepted/owned | `list_id`, `method`, `role` | No | No owner/member identity. |
| `start_purchase` | Purchase creation succeeds | `purchase_id`, `source`, `has_source_list`, `items_count`, `cart_items_count` | Yes | No product/list text. |
| `continue_purchase` | Existing purchase is opened from shortcut | `purchase_id`, `source`, `items_count`, `cart_items_count` | No | No product/list text. |
| `cancel_purchase` | Purchase cancellation succeeds | `purchase_id`, `source`, `items_count`, `cart_items_count` | No | No product/list text. |
| `add_to_cart` | Cart item create succeeds | `purchase_id`, `source`, `unit`, `category`, `quantity`, `price_paid` | No | No product name, brand, or notes. |
| `update_cart_item` | Cart item update succeeds | `purchase_id`, `source`, `unit`, `category`, `quantity`, `price_paid` | No | No product name, brand, or notes. |
| `remove_from_cart` | Reserved for future cart remove UI | `purchase_id`, `source` | No | Not currently emitted because no direct UI exists. |
| `finish_purchase` | Purchase finish succeeds | `purchase_id`, `market_id`, `items_count`, `cart_items_count`, `subtotal_calculated`, `final_paid_amount`, `discount_amount` | Yes | No market name or item names. |
| `view_purchase_detail` | Purchase detail data loads | `purchase_id`, `market_id`, `items_count`, `subtotal_calculated`, `final_paid_amount` | No | No product/market names. |
| `search` | Debounced search term changes | `context`, `search_length`, optional `search_term` | No | `search_term` only if short and safe. |
| `view_price_comparison` | Compare page renders | `source` | No | No search text. |
| `compare_product_prices` | Compare results or product detail loads | `product_id` or `search_length`, `results_count` | No | No product name. |
| `select_market_from_comparison` | Market card clicked in product comparison | `product_id`, `market_id`, `results_count` | No | No market name. |
| `click_remove_ads` | Remove ads CTA click | `value`, `currency`, `provider` | No | No user identity. |
| `begin_remove_ads_checkout` | Checkout creation succeeds | `purchase_id`, `value`, `currency`, `provider` | Yes | Payment provider id only. |
| `remove_ads_purchase_success` | Success return page opens | `provider` | Yes | No user/payment identity. |
| `remove_ads_purchase_pending` | Pending return page opens | `provider` | No | No user/payment identity. |
| `remove_ads_purchase_failed` | Failure return page opens | `provider` | No | No user/payment identity. |
| `click_install_pwa` | Browser install prompt CTA clicked | `source` | No | No user identity. |
| `app_installed` | Browser fires `appinstalled` | `source` | No | No user identity. |
| `ad_slot_view` | Ad slot renders | `slot`, `provider`, `location` | No | No user identity. |
| `ad_slot_click_house` | House/placeholder ad slot clicked | `slot`, `provider`, `location` | No | Dev/staging placeholder only. |
| `no_ads_active` | User status indicates no ads | `source` | No | No user identity. |

## App Area Mapping

- `/` -> `landing`
- `/login` -> `auth`
- `/app` -> `app`
- `/app/lists` -> `lists`
- `/app/purchase` -> `purchase`
- `/app/history` -> `history`
- `/app/compare` -> `compare`
- `/app/billing` -> `billing`
- `/app/settings` -> `settings`

