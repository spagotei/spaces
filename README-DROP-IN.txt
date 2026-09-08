Spaces full frontend drop-in v32.3

Copy everything in this folder into your SpacesApp project root and choose Merge / Replace.

Role model update:
- Owner and Member are now the only permanent base roles.
- Owner is always at the top and Member is always at the bottom.
- Owner and Member can be renamed for display, but they cannot be deleted or reordered.
- Administrator and Staff are normal Space roles now.
- New Spaces still start with Administrator and Staff already created.
- Administrator, Staff and every other custom role can be renamed, reordered, edited or deleted.
- A custom role can sit above Administrator or Staff.
- Manage Roles follows hierarchy: you can only edit, move or assign roles below your highest role, and you cannot manage a member at or above your hierarchy.
- Deleting a role removes it from everyone without removing those members from the Space.
- Existing legacy Administrator/Staff memberships are converted automatically when the Space owner opens Roles & Permissions.
- The Staff page now derives staff status from actual management/moderation permissions instead of hard-coded Administrator/Staff base levels.
- Member profile role controls now use the same hierarchy rules.
- Normal Member no longer receives audit-log access from the legacy viewer fallback.

This update uses the existing custom-role and member-role endpoints. No new npm package or manual D1 migration is required for this frontend conversion.

Run:
  npm.cmd run desktop


v32.1 startup fix:
- Fixes the blank window introduced in v32.0. The role-model upgrade callback referenced `profile` before it existed, causing SpacesProvider to throw during the first render.
- No role behavior was removed or rolled back.


v32.2: Emoji management moved from the Space sidebar into Settings > Decorate.

v32.3: Animated profile artwork is restricted to Founder surfaces.
- The Spaces Founder profile can use GIF profile photos and banners.
- Spaces - Hub can use GIF pictures and banners when edited by the Founder.
- Any other Space owned by the Founder can also use GIF artwork.
- Other users and other Spaces remain PNG/JPEG/WebP only.
- GIFs bypass the cropper so animation is preserved and are limited to 250 KB to stay inside the current Worker request limit.


Spaces v32.4 UI polish
- Repaired Space Profile media layout so picture and banner align instead of creating a large empty banner block.
- Tightened Space Settings cards, fields, frame picker, backgrounds, lists and save bar.
- Added consistent focus, scrollbar and modal finishing touches.
- No API, database or dependency changes.
