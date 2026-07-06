// @vitest-environment happy-dom
//
// End-to-end coverage of the QR-scan surface in the Add Account flow.
// Playwright can't drive this in-sandbox — the flow needs a real camera
// stream AND a client-decrypted vault key AND a Supabase write — so we
// mount ScanTab against happy-dom and mock only the ZXing boundary.
// Everything inside the component (latch, camera-init effect, remount
// key contract) runs for real.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { render, cleanup } from "@testing-library/react";
import { ScanTab } from "./ScanTab";

type DecodeCb = (result: { getText: () => string } | null) => void;

interface DecodeCall {
  cb: DecodeCb;
  stop: ReturnType<typeof vi.fn>;
}

const decodeCalls: DecodeCall[] = [];
let imageDecodeText = "otpauth://totp/Test:me@x?secret=JBSWY3DPEHPK3PXP";
let imageDecodeShouldThrow = false;

vi.mock("@zxing/browser", () => {
  class BrowserQRCodeReader {
    async decodeFromVideoDevice(_dev: unknown, _el: HTMLVideoElement, cb: DecodeCb) {
      const stop = vi.fn();
      decodeCalls.push({ cb, stop });
      return { stop };
    }
    async decodeFromImageUrl(_url: string) {
      if (imageDecodeShouldThrow) throw new Error("decode failed");
      return { getText: () => imageDecodeText };
    }
  }
  return { BrowserQRCodeReader };
});

// URL.createObjectURL isn't in happy-dom's minimal surface.
if (typeof URL.createObjectURL === "undefined") {
  Object.defineProperty(URL, "createObjectURL", { value: () => "blob:mock", writable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: () => {}, writable: true });
}

const URI = "otpauth://totp/Acme:me@x?secret=JBSWY3DPEHPK3PXP&issuer=Acme";

// Flush the microtask queue enough times to resolve the dynamic import,
// the async decodeFromVideoDevice promise, and the state updates that
// follow. Two ticks aren't always enough on happy-dom.
async function flushEffects() {
  await act(async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  });
}

beforeEach(() => {
  decodeCalls.length = 0;
  imageDecodeShouldThrow = false;
  imageDecodeText = URI;
});

afterEach(() => cleanup());

describe("ScanTab — video scan flow", () => {
  it("fires onDetected exactly once and stops the camera (successful save)", async () => {
    const onDetected = vi.fn();
    const onError = vi.fn();
    render(
      <ScanTab
        onDetected={onDetected}
        onError={onError}
        saving={false}
        switchToManual={() => {}}
      />,
    );
    await flushEffects();

    expect(decodeCalls).toHaveLength(1);
    const call = decodeCalls[0];

    await act(async () => call.cb({ getText: () => URI }));

    expect(onDetected).toHaveBeenCalledTimes(1);
    expect(onDetected).toHaveBeenCalledWith(URI);
    expect(call.stop).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("dedupes duplicate frames — latch guards onDetected", async () => {
    const onDetected = vi.fn();
    render(
      <ScanTab
        onDetected={onDetected}
        onError={() => {}}
        saving={false}
        switchToManual={() => {}}
      />,
    );
    await flushEffects();
    const call = decodeCalls[0];

    // Three frames back-to-back — the scanner can emit several before
    // controls.stop() takes effect. Only the first one should propagate.
    await act(async () => {
      call.cb({ getText: () => URI });
      call.cb({ getText: () => URI });
      call.cb({ getText: () => URI });
    });

    expect(onDetected).toHaveBeenCalledTimes(1);
    expect(call.stop).toHaveBeenCalledTimes(1);
  });

  it("ignores non-otpauth QR payloads", async () => {
    const onDetected = vi.fn();
    render(
      <ScanTab
        onDetected={onDetected}
        onError={() => {}}
        saving={false}
        switchToManual={() => {}}
      />,
    );
    await flushEffects();
    await act(async () => decodeCalls[0].cb({ getText: () => "https://example.com" }));
    expect(onDetected).not.toHaveBeenCalled();
  });

  it("does NOT restart the camera when parent re-renders with new callback identities", async () => {
    // Regression guard for the pre-fix bug where useEffect depended on
    // onDetected / onError and every parent render tore down the camera.
    const { rerender } = render(
      <ScanTab
        onDetected={vi.fn()}
        onError={vi.fn()}
        saving={false}
        switchToManual={() => {}}
      />,
    );
    await flushEffects();
    expect(decodeCalls).toHaveLength(1);

    rerender(
      <ScanTab
        onDetected={vi.fn()}
        onError={vi.fn()}
        saving={true}
        switchToManual={() => {}}
      />,
    );
    await flushEffects();

    expect(decodeCalls).toHaveLength(1);
  });

  it("recovers on save failure via parent remount (key bump)", async () => {
    // Simulates the parent's contract: when the QR-triggered save fails,
    // it bumps a `key` prop that unmounts + remounts ScanTab. A fresh
    // camera comes up, the latch resets, and a subsequent detection
    // propagates again.
    const onDetected = vi.fn();
    const props = {
      onDetected,
      onError: () => {},
      saving: false,
      switchToManual: () => {},
    };
    const { rerender } = render(
      <div>
        <ScanTab key="attempt-0" {...props} />
      </div>,
    );
    await flushEffects();

    await act(async () => decodeCalls[0].cb({ getText: () => URI }));
    expect(onDetected).toHaveBeenCalledTimes(1);
    expect(decodeCalls[0].stop).toHaveBeenCalled();

    // Parent's save fails → bumps key → ScanTab remounts.
    rerender(
      <div>
        <ScanTab key="attempt-1" {...props} />
      </div>,
    );
    await flushEffects();

    expect(decodeCalls).toHaveLength(2);
    // stop() runs on detection AND again on cleanup — both should have fired.
    expect(decodeCalls[0].stop).toHaveBeenCalled();

    await act(async () => decodeCalls[1].cb({ getText: () => URI }));
    expect(onDetected).toHaveBeenCalledTimes(2);
  });

  it("cleanup stops the camera when unmounting", async () => {
    const { unmount } = render(
      <ScanTab
        onDetected={vi.fn()}
        onError={vi.fn()}
        saving={false}
        switchToManual={() => {}}
      />,
    );
    await flushEffects();
    const stop = decodeCalls[0].stop;
    unmount();
    expect(stop).toHaveBeenCalled();
  });
});
