import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";

export const Route = createFileRoute("/dev/tokens")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Design tokens · Aegis dev" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: TokensPage,
});

type TokenGroup = {
  name: string;
  tokens: { var: string; note?: string }[];
};

const GROUPS: TokenGroup[] = [
  {
    name: "Surfaces",
    tokens: [
      { var: "--aegis-cream", note: "Base app background" },
      { var: "--aegis-cream-soft", note: "Elevated surfaces, cards, sheets" },
      { var: "--aegis-border", note: "Hairline dividers" },
    ],
  },
  {
    name: "Text",
    tokens: [
      { var: "--aegis-ink", note: "Primary text" },
      { var: "--aegis-muted", note: "Secondary / meta text" },
      { var: "--aegis-placeholder", note: "Input placeholders" },
    ],
  },
  {
    name: "Status",
    tokens: [
      { var: "--aegis-success", note: "Valid, ready, connected" },
      { var: "--aegis-warning", note: "Starting, pending" },
      { var: "--aegis-danger", note: "Destructive, error" },
      { var: "--aegis-fav", note: "Favorite / pinned" },
      { var: "--aegis-scanner-bg", note: "Camera scanner surface" },
    ],
  },
  {
    name: "Glow",
    tokens: [
      { var: "--aegis-glow-a" },
      { var: "--aegis-glow-b" },
      { var: "--aegis-glow-c" },
      { var: "--aegis-glow-orb-a" },
      { var: "--aegis-glow-orb-b" },
    ],
  },
  {
    name: "Grain",
    tokens: [{ var: "--aegis-grain", note: "Film-grain overlay tint" }],
  },
];

type Mode = "system" | "light" | "dark";

function TokensPage() {
  const [mode, setMode] = useState<Mode>("system");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const root = document.documentElement;
    if (mode === "system") {
      root.classList.remove("dark");
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      if (mq.matches) root.classList.add("dark");
      const onChange = (e: MediaQueryListEvent) => {
        root.classList.toggle("dark", e.matches);
        setTick((t) => t + 1);
      };
      mq.addEventListener("change", onChange);
      setTick((t) => t + 1);
      return () => mq.removeEventListener("change", onChange);
    }
    root.classList.toggle("dark", mode === "dark");
    setTick((t) => t + 1);
  }, [mode]);

  return (
    <div
      className="min-h-screen"
      style={{
        background: "var(--aegis-cream)",
        color: "var(--aegis-ink)",
        fontFamily: "'Geist', ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <header
        className="sticky top-0 z-10 border-b backdrop-blur"
        style={{
          background: "rgb(var(--aegis-ink-rgb) / 0.02)",
          borderColor: "var(--aegis-border)",
        }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <div className="text-[11px] uppercase" style={{ color: "var(--aegis-muted)", letterSpacing: "0.22em" }}>
              Aegis · Dev
            </div>
            <h1 className="text-[20px] font-semibold tracking-tight">Design tokens</h1>
          </div>
          <div
            className="flex items-center gap-1 rounded-full p-1"
            style={{ background: "rgb(var(--aegis-ink-rgb) / 0.06)" }}
          >
            <ModeButton current={mode} value="system" onSelect={setMode}>
              <Monitor className="h-3.5 w-3.5" /> Auto
            </ModeButton>
            <ModeButton current={mode} value="light" onSelect={setMode}>
              <Sun className="h-3.5 w-3.5" /> Light
            </ModeButton>
            <ModeButton current={mode} value="dark" onSelect={setMode}>
              <Moon className="h-3.5 w-3.5" /> Dark
            </ModeButton>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {GROUPS.map((group) => (
          <section key={group.name} className="mb-10">
            <h2
              className="mb-3 text-[11px] uppercase"
              style={{ color: "var(--aegis-muted)", letterSpacing: "0.22em" }}
            >
              {group.name}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.tokens.map((t) => (
                <TokenCard key={t.var} name={t.var} note={t.note} tick={tick} />
              ))}
            </div>
          </section>
        ))}
        <footer
          className="mt-12 border-t pt-6 text-[12px]"
          style={{ borderColor: "var(--aegis-border)", color: "var(--aegis-muted)" }}
        >
          Internal preview only. Toggle above to verify every token flips correctly between light and dark modes.
        </footer>
      </main>
    </div>
  );
}

function ModeButton({
  current,
  value,
  onSelect,
  children,
}: {
  current: Mode;
  value: Mode;
  onSelect: (m: Mode) => void;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors"
      style={{
        background: active ? "var(--aegis-ink)" : "transparent",
        color: active ? "var(--aegis-cream)" : "var(--aegis-ink)",
      }}
    >
      {children}
    </button>
  );
}

function TokenCard({ name, note, tick }: { name: string; note?: string; tick: number }) {
  const [resolved, setResolved] = useState("");
  useEffect(() => {
    const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    setResolved(val);
  }, [name, tick]);

  return (
    <div
      className="overflow-hidden rounded-[14px] border"
      style={{
        borderColor: "var(--aegis-border)",
        background: "var(--aegis-cream-soft)",
      }}
    >
      <div
        className="h-16 w-full"
        style={{ background: `var(${name})` }}
        aria-hidden
      />
      <div className="px-3 py-2.5">
        <div className="font-mono text-[12px]" style={{ color: "var(--aegis-ink)" }}>
          {name}
        </div>
        <div className="mt-1 font-mono text-[11px]" style={{ color: "var(--aegis-muted)" }}>
          {resolved || "—"}
        </div>
        {note && (
          <div className="mt-1.5 text-[12px]" style={{ color: "var(--aegis-muted)" }}>
            {note}
          </div>
        )}
      </div>
    </div>
  );
}
