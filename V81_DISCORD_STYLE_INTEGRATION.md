# Spaces V81.1 — Discord-style Calls, Voice Channels, and Streaming

## What is installed now

- Fixes the V81.0 Node 24 `exports is not defined` test failure by writing compiled CommonJS test modules with explicit `.cjs` extensions.
- Reinstalls the 22 supplied sound cues and typed 1:1 WebRTC media engine, unchanged.
- Adds an accessible vector icon set (phone, hangup, video, screen share, microphone, deafen, users, lock, stream, settings) and Unicode fallbacks for places where emoji are preferred.
- Adds typed voice-channel permission and DM/channel action descriptors, **not server authorization**.
- Preserves existing Spaces DM, Support, legal, Partner, and staff code. No Worker changes, migrations, deployments, release version bump, or visible call buttons.

## Required in the actual Spaces interface

**Direct messages:** phone icon for voice call, camera icon for video call, incoming call sheet with accept/decline, ringing, missed call, connected call panel, mute/deafen, camera, screen share, participant volume, device settings, hangup. Group DMs need explicit invite/participant permissions.

**Server channels:** add a `Voice` channel type in channel creation; show speaker glyph, connected users below channel, join/leave and active call strip; clicking a participant exposes volume/mute (local), profile, report and authorized moderator actions. Channel edit includes user limit, bitrate, and role/member permission overwrites.

**Go Live:** start/stop screen share, watch stream, streaming status, privacy indicator, viewers, permissions and moderation. Use SFU for multiple viewers; do not use a full-mesh WebRTC topology for large voice rooms.

**Permission matrix (server enforced):** view_channel, connect, speak, video, stream, watch_stream, mute_members, deafen_members, move_members, disconnect_members, manage_voice_channel. Role inheritance, channel overrides and explicit deny need to be evaluated on the Worker for every join/action. Don't trust UI flags.

**Sounds:** existing original 22-event pack; respect DND, settings and ringing cleanup.

**Mobile:** large touch targets, long-press context menus, persistent in-call strip, foreground capture indicator, Android microphone/camera permissions and separate Android screen-capture implementation.

## Live-service dependencies (not implemented by this installer)

- Authenticated Worker call signaling and participant authorization; server-issued IDs; rate limiting and call expiry.
- Reliable delivery for call events (Durable Objects or another appropriate real-time transport), TURN credentials with short lifetime, and an SFU for rooms and streams.
- Production DM and channel integration using current `SpacesApp` and `SpacesSite` source. Do not mount controls that appear functional until these endpoints exist.
- Two-account/two-network functional tests, Android lifecycle tests, privacy and moderation review.

**Migration 0033** for Partner/Email/Archives is separate and is not changed here. No migration 0034 is created.
