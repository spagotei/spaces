# Spaces V81.1 — Sound Pack + WebRTC 1:1 Media Foundation

**Status:** local source and assets installed. **Not** a working production call feature. No Worker signaling endpoint, TURN credentials, SFU, server-side call permissions, call UI, voice channels, or Android screen capture service has been installed by this patch. No database migration, deployment, or version bump is performed.

## V81.1 compatibility fix

The test harness emits explicit `.cjs` modules so Node 24 does not treat generated CommonJS as ESM when an ancestor `package.json` sets `"type": "module"`. A Discord-style icon catalog and voice permission **UI contract** are included, but neither enables calls or authorizes channel actions. See `V81_DISCORD_STYLE_INTEGRATION.md`.

## Included

- All **22 user-supplied sound events**, with original MP3 and OGG encodings and WAV masters for the three repeating cues.
- A sound controller that honors a caller-supplied DND/sounds setting, disables viewer sounds by default, deduplicates busy-room cues, and stops ring/reconnection loops.
- A **1:1 WebRTC media engine** for offers/answers/ICE, microphone, mute/deafen, camera, switching input devices, screen sharing (replaces camera in this foundation), and cleanup on hangup. It **does not** connect two users until a secure, authorized signaling transport is supplied.
- `npm run voice:check`: local mocked-media tests of sound behavior and WebRTC state transitions. It never contacts the network or captures real devices.

## Where the assets go

- `public/spaces-call-sounds/v81/mp3/` and `ogg/`: 22 events each
- `public/spaces-call-sounds/v81/wav/`: looping ringtone/outgoing/reconnecting masters
- `public/spaces-call-sounds/v81/manifest.json`: original user sound pack manifest
- `src/features/voice/v81/`: sound controller, media engine and typed manifest

## Integration

```ts
import { SpacesCallSoundsV81 } from './features/voice/v81/SpacesCallSoundsV81'
import { SpacesPeerCallV81 } from './features/voice/v81/SpacesPeerCallV81'

const sounds = new SpacesCallSoundsV81({
  isDoNotDisturb: () => existingUserSettings.doNotDisturb,
  isSoundsEnabled: () => existingUserSettings.soundsEnabled,
})

// Construct only after the authenticated Worker has created/authorized the call.
const call = new SpacesPeerCallV81({
  callId: serverIssuedCallId,
  rtcConfig: await fetchEphemeralIceServersFromWorker(),
  sounds,
  transport: { send: signal => authenticatedWorkerSignalSend(signal) },
  callbacks: {
    onState: state => updateCallUi(state),
    onRemoteTrack: (track, stream) => attachRemoteMedia(track, stream),
    onError: error => reportCallError(error),
  },
})
```

The example names are **integration placeholders**, not functions added by this installer. Do not mount a call button until the transport and server authorization are implemented.

## Required next for live calls and streams

1. **Worker signaling**: authenticated call create/invite/accept/decline/hangup, participant checks, server-side authorization for DM/group/voice-channel access, rate limiting, call expiry and signaling delivery. Prevent unauthorized users from requesting or joining another call.
2. **Connectivity**: TURN with short-lived credentials for restrictive networks; no public permanent TURN secrets in frontend. A SFU for voice rooms and multi-viewer streaming, not a mesh that scales quadratically.
3. **App integration**: DM call UI, incoming ringing, controls, permission prompts, remote media elements, settings and DND, notifications, device selection, mobile lifecycle and long-press actions.
4. **Screen sharing**: browser/desktop getDisplayMedia and Android-specific capture permission/foreground service. Always show a visible sharing indicator and stop on logout, disconnect or app shutdown.
5. **Privacy and moderation**: update Terms/Privacy for call metadata; no recording without separate explicit consent; server-side roles/permissions and report controls.
6. **Testing**: two actual devices and separate networks, Android/WebView support, TURN-only paths, SFU load tests, reconnect, mute/deafen, screen-capture stop, call expiry, DND, sound controls and audio feedback loops.

**No migration 0034 has been created.** Migration 0033 for Partner/Email/Archives is a separate pending V80 change.
