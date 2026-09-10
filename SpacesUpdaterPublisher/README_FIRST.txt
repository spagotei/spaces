Spaces 0.0.23 — People, Security & Identity

RUN IN THIS ORDER:
1. APPLY_0.0.23.ps1
2. VERIFY_0.0.23.ps1
3. DEPLOY_SPACES_BACKEND_0.0.23.ps1
4. RUN_0.0.23.ps1

Do not publish until the desktop UI and new People/Message Request flow are tested.

WHAT REQUIRES THE BACKEND DEPLOY:
- Message Requests
- Direct messages
- Per-Space Privacy & DMs preference
These use D1 migration 0017.

2FA:
Authenticator 2FA was already implemented in the Spaces Worker and database. 0.0.23 makes the complete setup/recovery/login flow accessible and polished in Account Settings > Security. It does not require email.

EMAIL:
The email verification backend exists, but actual sending still depends on the Cloudflare Email binding + Spaces sender configuration. 0.0.23 cleans the UI and clearly reports that state; it does not pretend mail is connected when it is not.

CLOUDFLARE CUTOVER:
The Worker is Spaces: https://spaces.spagotei.workers.dev
The current D1 resource is still named scrounge-spaces only to preserve the live dataset during cutover. That resource name does NOT mean traffic is hitting scrounge-spaces-api.

LATER, AFTER TESTING:
- BUILD_SIGNED_0.0.23.ps1
- PUBLISH_0.0.23.ps1
