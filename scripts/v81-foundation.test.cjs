'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(process.argv[2] || process.cwd());
const soundsDir = path.join(root, 'public/spaces-call-sounds/v81');
const manifest = JSON.parse(fs.readFileSync(path.join(soundsDir, 'manifest.json'), 'utf8'));
assert.equal(manifest.sounds.length, 22, '22 sounds must be present');
const ids = new Set(manifest.sounds.map(s => s.id));
assert.equal(ids.size, 22, 'event ids must be unique');
for (const entry of manifest.sounds) {
  for (const fmt of ['mp3', 'ogg']) {
    const f = path.join(soundsDir, entry.files[fmt]);
    assert(fs.statSync(f).size > 1000, `missing or empty ${f}`);
  }
  if (entry.loop) assert(fs.statSync(path.join(soundsDir, entry.files.wav)).size > 1000);
}
const { SpacesCallSoundsV81 } = require(path.join(process.env.SPACES_V81_TEST_BUILD_DIR || path.join(root, '.v81-test-build'), 'SpacesCallSoundsV81.cjs'));
const { SpacesPeerCallV81 } = require(path.join(process.env.SPACES_V81_TEST_BUILD_DIR || path.join(root, '.v81-test-build'), 'SpacesPeerCallV81.cjs'));
const { SPACES_VOICE_CHANNEL_PERMISSIONS_V81, SPACES_VOICE_UI_ACTIONS_V81 } = require(path.join(process.env.SPACES_V81_TEST_BUILD_DIR || path.join(root, '.v81-test-build'), 'SpacesVoiceUiContractV81.cjs'));
const keys = SPACES_VOICE_CHANNEL_PERMISSIONS_V81.map(p=>p.key);
assert.equal(new Set(keys).size, keys.length, 'voice permission keys must be unique');
for (const key of ['view_channel','connect','speak','video','stream','watch_stream','mute_members','deafen_members','move_members','disconnect_members','manage_voice_channel']) assert(keys.includes(key), `missing voice permission ${key}`);
for (const key of ['dm_voice_call','dm_video_call','dm_screen_share','voice_join','voice_leave','voice_mute','voice_deafen','voice_stream','voice_watch_stream']) assert(SPACES_VOICE_UI_ACTIONS_V81[key]?.icon, `missing icon mapping ${key}`);
const played = [];
class AudioMock {
  constructor(src) { this.src = src; this.volume = 1; this.currentTime = 0; this.loop = false; this.listeners = {}; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  play() { played.push(this.src); return Promise.resolve(); }
  pause() { this.paused = true; }
}
global.Audio = AudioMock;
class TrackMock {
  constructor(kind) { this.kind = kind; this.enabled = true; this.stopped = false; }
  stop() { this.stopped = true; }
}
class StreamMock {
  constructor(tracks) { this.tracks = tracks; }
  getAudioTracks() { return this.tracks.filter(t => t.kind === 'audio'); }
  getVideoTracks() { return this.tracks.filter(t => t.kind === 'video'); }
}
global.MediaStream = StreamMock;
const pcInstances = [];
class PeerMock {
  constructor() { this.connectionState = 'new'; this.receivers = [{track: new TrackMock('audio')}]; pcInstances.push(this); }
  addTransceiver(kind) { const sender = { track: null, replaceTrack: async t => { sender.track = t; } }; return {sender}; }
  createOffer() { return Promise.resolve({type:'offer',sdp:'test-offer'}); }
  createAnswer() { return Promise.resolve({type:'answer',sdp:'test-answer'}); }
  async setLocalDescription(desc) { this.localDescription = desc; }
  async setRemoteDescription(desc) { this.remoteDescription = desc; }
  async addIceCandidate(candidate) { this.lastIce = candidate; }
  getReceivers() { return this.receivers; }
  restartIce() { this.restarted = true; }
  close() { this.closed = true; }
  connect() { this.connectionState = 'connected'; this.onconnectionstatechange?.(); }
}
global.RTCPeerConnection = PeerMock;
Object.defineProperty(global, 'navigator', { configurable: true, value: { mediaDevices: {
  getUserMedia: async constraints => new StreamMock([new TrackMock(constraints.video ? 'video' : 'audio')]),
  getDisplayMedia: async () => new StreamMock([new TrackMock('video')])
}} });
(async () => {
  const mutedSounds = new SpacesCallSoundsV81({isDoNotDisturb:()=>true});
  assert.equal(await mutedSounds.play('ringtone'), false, 'DND suppresses sounds');
  const snd = new SpacesCallSoundsV81();
  assert.equal(await snd.play('viewer_joined'), false, 'viewer sounds default off');
  assert.equal(await snd.play('ringtone'), true, 'ringtone plays');
  assert.equal(await snd.play('ringtone'), false, 'loop replay suppressed within dedupe window');
  snd.stopLoops();
  assert.equal(snd.playing.size, 0, 'loop stopped');
  const aSound = new SpacesCallSoundsV81(), bSound = new SpacesCallSoundsV81();
  let a, b;
  const id = 'test-call-123456';
  a = new SpacesPeerCallV81({callId:id, transport:{send:async s=>b.receive(s)}, rtcConfig:{iceServers:[]}, sounds:aSound});
  b = new SpacesPeerCallV81({callId:id, transport:{send:async s=>a.receive(s)}, rtcConfig:{iceServers:[]}, sounds:bSound});
  await a.call();
  assert.equal(a.state, 'calling');
  assert.equal(b.state, 'incoming');
  await b.receive({callId:id,type:'ice',candidate:{candidate:'candidate:test',sdpMid:'0'}});
  await b.accept();
  assert.equal(a.state, 'connecting');
  assert.equal(b.state, 'connecting');
  assert.equal(pcInstances[1].lastIce.candidate, 'candidate:test');
  pcInstances[0].connect(); pcInstances[1].connect();
  assert.equal(a.state, 'connected');
  assert.equal(b.state, 'connected');
  a.setMuted(true);
  assert.equal(a.audioTrack.enabled, false);
  a.setDeafened(true);
  assert.equal(pcInstances[0].receivers[0].track.enabled, false);
  await a.setCamera(true);
  const camera = a.cameraTrack;
  assert(camera && !camera.stopped);
  await a.startScreenShare();
  assert(camera.stopped, 'camera stops when screen share begins');
  assert(a.screenTrack && !a.screenTrack.stopped);
  await a.stopScreenShare();
  assert.equal(a.screenTrack, null);
  await a.hangup();
  assert.equal(a.state, 'ended');
  assert.equal(b.state, 'ended');
  assert(pcInstances[0].closed && pcInstances[1].closed);
  assert(played.some(x=>x.includes('spaces-ringtone.wav')), 'precise ringtone loop uses WAV');
  console.log('PASS V81.1 sound pack 22 cues, voice permission contract, icon mappings, DND, viewer defaults, ringtone loop controls, 1:1 offer/answer, ICE queue, mute/deafen, camera, screen sharing, hangup cleanup');
})().catch(e => { console.error(e); process.exitCode = 1; });
