# Spaces V80 — Archive, Support, and Report Release QA

This is a **release blocker checklist**, not a claim that the Worker or database has been tested. Run with a real Founder account, a Support/Staff account, and a normal member account, on desktop, web, and Android. Use only disposable test tickets/reports. Never use real customer reports for destructive testing.

## Before testing

- Apply all pending D1 migrations to the correct environment and verify the schema; make a backup first.
- Verify the actual Worker API is deployed and that the app points at the correct Worker origin.
- Use separate accounts and a test Space. Check that the mobile build is running the same backend and version.
- Open developer logs; confirm no repeated polling loops, stale caches, failed network calls, or authorization bypasses.

## Member ticket lifecycle

- [ ] Create a ticket. It appears in the member's open list and the staff waiting queue, once each.
- [ ] Staff takes the ticket. The assignee and status are reflected for the member; waiting count and orange indicator update without a reload.
- [ ] Staff replies. Member receives the correct verified staff identity and notification; replies persist after restart.
- [ ] Member closes a ticket with a reason. It leaves open lists on both sides, retains its history, and shows who closed it and why.
- [ ] Member archives a closed ticket. It disappears from the active list, remains in their archive, and does not disappear from authorized staff history.
- [ ] Member reopens a closed/archived ticket if policy allows. It returns to the active queue exactly once and staff is notified.
- [ ] Member cannot reopen a permanently deleted ticket or another member's ticket.
- [ ] Refresh, log out/in, switch device, and verify the archive and unread state persists from the server.

## Staff/Founder ticket lifecycle

- [ ] Support/Staff can assign, review, resolve, close with a reason, and archive only where their role permits.
- [ ] Archived cases appear in the staff archive/history with original messages, author, timestamps, and moderation metadata.
- [ ] Staff can resolve or close a case from the resolved/archived view where the product policy permits.
- [ ] Closing a ticket removes it from waiting/reviewing counters and orange taskbar indicator immediately.
- [ ] Founder can permanently delete a disposable case; it is gone from active, resolved, archived, member, and staff lists after reload.
- [ ] Support and regular members cannot permanently delete a case unless explicitly granted the permission by server policy.
- [ ] Repeating archive/close/delete actions does not create duplicate records or resurrect ghost cases.
- [ ] A stale client receives a conflict/not-found response rather than silently recreating a deleted case.
- [ ] Audit records identify actor, action, target, timestamp, and reason without exposing private content to unauthorized users.

## Player / Space / Bug reports

- [ ] Each report type appears in its correct staff tab with accurate waiting/reviewing/resolved/archived counts.
- [ ] Right-click on desktop and long-press on Android expose the same allowed report actions.
- [ ] Resolve, archive, reopen (if supported), and permanent delete behave consistently for all report types.
- [ ] Member visibility follows report privacy rules; one member cannot see another member's report.
- [ ] Restrictions/ban timers and permission changes are enforced by the Worker, not only hidden by the UI.

## Direct messages / Space archives

- [ ] Hiding/archiving a DM is private to that member and survives restart/device changes.
- [ ] A new message restores the conversation to recents if that is the intended policy, without duplicate threads.
- [ ] Archiving a ticket never deletes or hides an unrelated DM or Space.
- [ ] If a Space has an archive feature, channel/message access respects permissions after archiving and restoration.

## Retention and deletion

- [ ] Confirm the **actual** retention period matches the published Terms/Privacy Policy and server configuration. Do not promise 30/60-day deletion without a deployed scheduled job.
- [ ] Verify the scheduled cleanup deletes only eligible archived records and preserves legally required audit records according to the published policy.
- [ ] Verify a test account deletion request affects its records consistently, subject to legitimate retention exceptions.

## Security and cross-platform

- [ ] Member cannot call staff archive/delete endpoints directly, including by modifying request JSON or IDs.
- [ ] Support cannot act as Founder; Staff cannot change Founder restrictions.
- [ ] Check CSRF protection for cookie-based APIs, rate limits, authorization checks, and no private data in public API responses.
- [ ] Test desktop/web/Android back-to-back with the same test case; status and counters converge without a full restart.

## Run the source audit

```powershell
cd "C:\Users\ldc-c\OneDrive\Documents\SpacesApp"
npm.cmd run beta:archives
```

The source audit reports matching code references, **not** runtime correctness. Complete the above live tests before publishing. Record failures and server logs. VC/streaming is reserved for the next release after these gates pass.
