# Spaces V80.2 — Legal, Partner, Email + Archive Readiness (TSX Fix)

V79 keeps the existing Spaces product and adds a beta UX/safety layer instead of replacing working features.

## Added
- Ctrl/Cmd+K quick switcher across visible Spaces, channels, DMs, links, and actions.
- Ctrl/Cmd+/ keyboard shortcut sheet; Alt+Up/Down keyboard navigation.
- Touch/mobile-safe overlays and 44px touch targets.
- Community / Partner / Official / Verified / Featured / Staff-owned / Beta Space identity badges.
- Deployment-owned public trust registry at public/spaces-trust.json.
- Runtime hardening of external links (noopener + noreferrer) and blocking of javascript: anchors.
- Discord-like unread, mention, code block, spoiler, presence, hover-action, message, drawer, and modal polish.
- Reduced-motion support and stronger keyboard focus visibility.
- Beta safety gate for obvious XSS primitives, client-side secrets, unsafe Android permissions, trust-registry shape, and desktop/web/mobile version parity.

## Trust registry
Edit public/spaces-trust.json before publishing. Example:

~~~json
{
  "version": 1,
  "spaces": {
    "SPACE_ID": {
      "classification": "partner",
      "verified": true,
      "featured": true,
      "label": "Spaces Partner"
    }
  }
}
~~~

classification may be community, partner, or official. verified, featured, beta, and staffOwned are independent display flags.

IMPORTANT: badges are presentation metadata only. Never use this registry for moderation, staff, ownership, or API authorization.

## Release gates
- npm.cmd run beta:gate
- npm.cmd run typecheck
- npm.cmd run build:web
- npm.cmd run android:apk

Only publish after those gates pass and you have tested login, DMs, server messaging, Support, moderation, notifications, right-click/long-press, and mobile navigation with a real test account.


## V80 legal + support communications
- Docs-style Legal Center is available at /tos/ on the website.
- Partner Program is available at /partner/.
- Settings exposes Legal & Policies when a canonical SettingsView is found.
- Support Email Center provides server-safe template IDs, sender identities, previews, and optional image URLs.
- Actual delivery must be enforced server-side; never trust client-supplied From or Reply-To values.

## Partner approval workflow
1. Staff opens Support Console > Partner Program.
2. Review the Space, owner, moderation history, activity, and application.
3. Approve only through a server-authorized action.
4. The server records Partner status and an audit event.
5. The public trust badge is derived from the authoritative record.
6. Send the Partner Approved template from the Support Email Center.
