# Aegis Browser Extension (Phase 10.1 shell)

Manifest V3 extension that reuses the web app's zero-knowledge vault
primitives verbatim: `src/lib/vault-crypto.ts`, `src/lib/vault-accounts.ts`,
and `src/lib/biometric.ts` are imported via the shared `@/` alias — no
forking, no re-implementation.

## Layout

```
extension/
  manifest.json          # MV3 manifest (generated with VITE_SUPABASE_URL baked in)
  vite.config.ts         # Second Vite entry point (build only, no dev server)
  src/
    background.ts        # Service worker: idle keep-alive + message router
    content.ts           # Autofill probe — no-op shell until Phase 10.2
    popup/
      index.html         # Popup document
      main.tsx           # React root
      App.tsx            # Unlock + list stub
```

## Build

```bash
bun run build:ext         # → dist-ext/  (load unpacked in chrome://extensions)
```

## Security posture

- **Origin allow-list**: `host_permissions` starts empty. Sites are added
  at runtime via `chrome.permissions.request` (optional_host_permissions).
- **CSP**: `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'`. No
  remote code, no `unsafe-eval`, no inline scripts.
- **externally_connectable**: only the deployed web-app origins may
  `chrome.runtime.sendMessage` into the extension.
- **connect-src**: only the project's Supabase origin.
- **Permissions**: `storage`, `activeTab`, `scripting`, `alarms`. No
  `<all_urls>`, no `tabs`, no `webRequest`.

## Phase 10.2+ hooks

- `src/content.ts` is the placeholder for the OTP-field detector.
- `src/background.ts` exposes a `PING` handler used by content scripts to
  wake the service worker; extend with `MATCH_ACCOUNT` / `GET_CODE`
  handlers when autofill lands.
