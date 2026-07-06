# Extension Heartbeat & Silent Resync — Manual Test Checklist

Ei checklist ta MV3 service worker eviction / idle-lock / TTL-expiry er por
web-app er heartbeat auto-resync thik moto kaj korche ki na — seta verify
korar jonno.

## Debug logging chalu korun

Debug log default e OFF. Chalu korte:

**Web app (browser DevTools console):**
```js
localStorage.setItem("aegis:debug:heartbeat", "1")
location.reload()
```
Off korte: `localStorage.removeItem("aegis:debug:heartbeat")`

Console e `[aegis-hb]` prefixed log ashbe (tick, resync decision, resync
result, seq mismatch, etc.).

**Extension (service worker console):**
`chrome://extensions` → Aegis → **Service worker** link click →
DevTools khulbe → Console tab.

`[aegis-sw]` prefixed log ashbe (SYNC_VAULT, GET_STATE, LOCK, TTL expiry,
rate limit, validation reject).

SW debug default ON — jodi bondho korte chan, background.ts er top-e
`SW_DEBUG = false` kore rebuild korun.

---

## Checklist

### 1. Baseline sync
- [ ] Web app e sign in + vault unlock
- [ ] Extension icon click → popup e accounts dekhaye
- [ ] SW console: `[aegis-sw] SYNC_VAULT ok` (seq=1, count=N)
- [ ] Web console (heartbeat on): `[aegis-hb] tick` prithi 30s por, `state.unlocked=true`, `seq match, skip`

### 2. Service worker eviction (idle > 30s)
- [ ] Extension e kono message pathaben na (browser use korun onno tab e)
- [ ] `chrome://serviceworker-internals` khule Aegis SW er status dekhun — 30s+ pore "stopped" hobe
  (alternate: `chrome://extensions` → Aegis er "service worker (inactive)" text)
- [ ] Aegis tab e phire eshe focus dilei — heartbeat tick fire hobe (visibility change)
- [ ] Web console: `[aegis-hb] state.unlocked=false, resync triggered`
- [ ] SW console (SW jege): `[aegis-sw] SYNC_VAULT ok` (seq bigger than last)
- [ ] Web console: `[aegis-hb] resync ok, seq=N+1`
- [ ] Extension popup khule verify: accounts abar ache

### 3. TTL expiry (5 min idle)
- [ ] Extension unlock kore rakhun, 5+ min kono interaction chara wait korun
- [ ] Web app tab e focus dilei heartbeat resync korbe
- [ ] SW console: age `[aegis-sw] GET_STATE unlocked=false` (TTL expired), tarpor `SYNC_VAULT`

### 4. Manual LOCK
- [ ] Popup e "Lock" button chapun (jodi thake) OR SW console e: `chrome.runtime.sendMessage({type:"LOCK"})`
- [ ] Next heartbeat tick — web console: `state.unlocked=false, resync triggered`
- [ ] SW console: `SYNC_VAULT ok`, extension abar unlocked

### 5. Multi-tab seq mismatch
- [ ] Tab A + Tab B duitai open, dutoi web app authenticated
- [ ] Tab A e vault e notun account add korun (auto-sync trigger hobe)
- [ ] Tab B er heartbeat tick e: `[aegis-hb] seq mismatch (local=X, remote=Y), resync triggered`
  (kokhon local > remote → tab B nijer copy push korbe)

### 6. Web vault locked → heartbeat idle
- [ ] Web app e vault lock korun
- [ ] Web console: `[aegis-hb] vault locked, skip` (koi resync attempt hobe na)
- [ ] Extension popup: locked state (previous TTL ba SW eviction er por)

### 7. Rate limit
- [ ] Web console e quick quick manual sync bar bar chalu korun (Security tab → Sync button)
- [ ] Second call SW e: `[aegis-sw] SYNC_VAULT rate_limited` (1s interval er modhye)

### 8. Bad payload rejection
- [ ] SW console e:
  ```js
  chrome.runtime.sendMessage("<self-id>", {type:"SYNC_VAULT", userId:"x", accounts:[{id:"1"}]}, console.log)
  ```
  Result: `{ok:false, error:"bad_account_shape"}` + SW log `validation failed`

### 9. Extension uninstalled
- [ ] Extension disable korun
- [ ] Web console: `[aegis-hb] extension not installed, skip` (koi network noise nai)

---

## Success criteria

- Heartbeat tick prithi 30s + on-focus + on-visibility fire hoy
- SW eviction ba TTL expiry er por, user ke kichu na kore silent resync hoy
- Web app locked hole heartbeat idle thake (kono resync attempt nai)
- Bad/oversized payload SW e reject hoy, unlocked state overwrite hoy na
- Rate limit per-origin kaj kore (1 SYNC_VAULT / 1s)

Test complete hole `localStorage.removeItem("aegis:debug:heartbeat")` diye
debug log off korte bhulben na.
