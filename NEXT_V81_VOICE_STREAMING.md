# Spaces V81 — Voice Channels & Screen Sharing (next update)

Planned after V80 archive and beta smoke tests pass. Not implemented in V80.

- Voice channel join/leave, mute/deafen, device choice, push-to-talk, speaking indicators, channel limits and server-side permissions.
- Reliable reconnection, switching devices, mobile background/foreground, network changes, and battery-conscious behavior.
- Screen sharing with explicit user consent and a persistent sharing indicator; stop/share controls and permission revocation.
- WebRTC transport with authenticated signaling, TURN for difficult networks, and SFU-based scaling rather than unbounded peer mesh.
- Moderation: disconnect/move/mute by role, abuse reports, anti-spam, and no unauthorized listening.
- Browser, desktop, Android parity, with explicit handling of OS screen capture permissions and Android foreground services.
- No silent recording, no invisible streaming, no fabricated E2EE promises; publish a separate privacy/consent section before launch.
- Load tests, media quality telemetry without collecting raw audio/video, and a feature flag/kill switch.
