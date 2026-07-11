// @vitest-environment happy-dom
//
// Smoke tests for the two inline stages of the Add/Import flow:
// `PasteTab` and `AvfPassStage`. They are exported from the route file
// (route only consumes `Route`, extra named exports are safe) so we can
// mount them without spinning up the full router.

import { describe, it, expect, vi } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";
import { PasteTab, AvfPassStage } from "@/routes/_authenticated/_locked/vault_.import";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("PasteTab", () => {
  it("renders textarea and submit button", () => {
    render(<PasteTab value="" onChange={() => {}} onSubmit={() => {}} />);
    expect(screen.getByRole("textbox")).toBeTruthy();
    expect(screen.getByText(/Read paste/i)).toBeTruthy();
    cleanup();
  });

  it("propagates textarea input via onChange", () => {
    const onChange = vi.fn();
    render(<PasteTab value="" onChange={onChange} onSubmit={() => {}} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "otpauth://" } });
    expect(onChange).toHaveBeenCalledWith("otpauth://");
    cleanup();
  });

  it("invokes onSubmit when the primary button is clicked", () => {
    const onSubmit = vi.fn();
    render(<PasteTab value="otpauth://x" onChange={() => {}} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByText(/Read paste/i));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    cleanup();
  });
});

describe("AvfPassStage", () => {
  it("disables the unlock button while passphrase is empty", () => {
    render(
      <AvfPassStage
        passphrase=""
        onChange={() => {}}
        busy={false}
        notice={null}
        onSubmit={() => {}}
      />,
    );
    const btn = screen.getByText(/Unlock backup/i).closest("button")!;
    expect(btn.disabled).toBe(true);
    cleanup();
  });

  it("enables the unlock button once a passphrase is present", () => {
    render(
      <AvfPassStage
        passphrase="hunter2"
        onChange={() => {}}
        busy={false}
        notice={null}
        onSubmit={() => {}}
      />,
    );
    const btn = screen.getByText(/Unlock backup/i).closest("button")!;
    expect(btn.disabled).toBe(false);
    cleanup();
  });

  it("submits on Enter key", () => {
    const onSubmit = vi.fn();
    render(
      <AvfPassStage
        passphrase="hunter2"
        onChange={() => {}}
        busy={false}
        notice={null}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.keyDown(screen.getByPlaceholderText(/Passphrase used at export time/i), {
      key: "Enter",
    });
    expect(onSubmit).toHaveBeenCalled();
    cleanup();
  });

  it("renders a notice when provided", () => {
    render(
      <AvfPassStage
        passphrase=""
        onChange={() => {}}
        busy={false}
        notice={{ kind: "error", text: "Wrong passphrase" }}
        onSubmit={() => {}}
      />,
    );
    expect(screen.getByText("Wrong passphrase")).toBeTruthy();
    cleanup();
  });
});
