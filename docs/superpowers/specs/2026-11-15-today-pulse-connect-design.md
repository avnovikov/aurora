# Today-screen pulse connection

**Status:** approved (2026-11-15)  
**Locale:** British English UI

## Goal

Connect the BLE pulse strap on the **Today** screen before Start, so BPM is ready when the session opens. Start stays best-effort if the strap is missing.

## Decisions

| Topic | Choice |
|-------|--------|
| Connect timing | Auto-attempt when Today opens; manual Connect/retry on failure |
| Start gating | None — Start works once sleep is chosen |
| Session Strap UI | Keep Connect / Disconnect as mid-session fallback |
| Web | No auto-connect when native BLE is unavailable; status explains Capacitor/Android; sim buttons stay session-only |

## Behaviour

1. Opening Today (native): show pulse status `Connecting…`, call `connectHeartRate` once per visit.
2. Success: status shows connected / live BPM when available; Connect button hidden.
3. Failure or disconnect: status shows the failure message; **Connect** retries.
4. Start does not wait for pulse.
5. Session mounts while already connected: attach BPM listeners without re-pairing; seed pulse watch as connected.
6. Leaving the session still disconnects the strap (existing dispose).

## Architecture

```
Today showTodayHome
  → pulse row (status + Connect)
  → connectHeartRate / subscribe listeners
Session renderSessionView
  → subscribe listeners (already-connected path)
  → Strap Connect / Disconnect fallback
hrMonitor
  → listener registry (fan-out BPM + disconnect)
  → single BLE session (activeDeviceId)
```

`connectHeartRate` registers the caller’s listeners even when already connected, so Today → Session handoff works without a second pair prompt. Callers unsubscribe when leaving Today so stale DOM handlers do not fire.

## Out of scope

- Blocking Start on pulse  
- Removing session Strap controls  
- Remembering last BLE device id across app restarts  

## Done when

- `npm test` + `npm run smell` green  
- Today auto-connects on native; Connect retries; Start always available after sleep  
- Session receives BPM from a pre-connected strap without reconnecting  
