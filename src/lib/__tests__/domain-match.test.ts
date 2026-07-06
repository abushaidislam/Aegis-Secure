import { describe, expect, it } from "vitest";
import {
  AUTOFILL_THRESHOLD,
  hostTokens,
  issuerTokens,
  normalizeHost,
  primaryHostLabel,
  rankMatches,
  scoreMatch,
} from "@/lib/domain-match";

describe("normalizeHost", () => {
  it("strips protocol, port, path, and leading www", () => {
    expect(normalizeHost("https://www.github.com:443/login")).toBe("github.com");
    expect(normalizeHost("HTTP://Accounts.Google.COM")).toBe("accounts.google.com");
    expect(normalizeHost("  example.org  ")).toBe("example.org");
  });
  it("returns '' for empty input", () => {
    expect(normalizeHost("")).toBe("");
  });
});

describe("hostTokens & primaryHostLabel", () => {
  it("drops TLD stopwords and short segments", () => {
    expect(hostTokens("accounts.github.com")).toEqual(["accounts", "github"]);
    expect(hostTokens("mail.google.com")).toEqual(["mail", "google"]);
    expect(hostTokens("github.io")).toEqual(["github"]);
  });
  it("picks the trailing meaningful label as primary", () => {
    expect(primaryHostLabel("accounts.github.com")).toBe("github");
    expect(primaryHostLabel("id.atlassian.com")).toBe("atlassian");
    expect(primaryHostLabel("localhost")).toBe("localhost");
  });
});

describe("issuerTokens", () => {
  it("splits on non-alphanumeric and drops stopwords", () => {
    expect(issuerTokens("GitHub (work)")).toEqual(["github", "work"]);
    expect(issuerTokens("Google", "alice@example.com")).toContain("google");
    expect(issuerTokens("Amazon Web Services")).toEqual(["amazon", "web", "services"]);
  });
});

describe("scoreMatch", () => {
  it("scores an exact brand match at the top", () => {
    expect(scoreMatch("github.com", "GitHub")).toBeGreaterThanOrEqual(AUTOFILL_THRESHOLD);
    expect(scoreMatch("accounts.google.com", "Google")).toBeGreaterThanOrEqual(
      AUTOFILL_THRESHOLD,
    );
  });
  it("handles subdomain-heavy hosts", () => {
    expect(scoreMatch("id.atlassian.com", "Atlassian")).toBeGreaterThanOrEqual(
      AUTOFILL_THRESHOLD,
    );
    expect(scoreMatch("auth0.openai.com", "OpenAI")).toBeGreaterThanOrEqual(0.55);
  });
  it("matches multi-word issuers with a shared token", () => {
    const s = scoreMatch("aws.amazon.com", "Amazon Web Services");
    expect(s).toBeGreaterThanOrEqual(0.55);
  });
  it("rejects unrelated brands", () => {
    expect(scoreMatch("github.com", "GitLab")).toBeLessThan(0.55);
    expect(scoreMatch("dropbox.com", "Google")).toBe(0);
  });
  it("gracefully handles empty inputs", () => {
    expect(scoreMatch("", "GitHub")).toBe(0);
    expect(scoreMatch("github.com", "")).toBe(0);
  });
});

describe("rankMatches", () => {
  const accounts = [
    { issuer: "GitHub", label: "personal" },
    { issuer: "GitHub", label: "work" },
    { issuer: "GitLab" },
    { issuer: "Google", label: "alice@example.com" },
    { issuer: "AWS", label: "root" },
  ];

  it("ranks all matching accounts strongest-first, ties preserve input order", () => {
    const ranked = rankMatches("github.com", accounts);
    expect(ranked.length).toBe(2);
    expect(ranked[0].account.issuer).toBe("GitHub");
    expect(ranked[0].account.label).toBe("personal");
    expect(ranked[1].account.label).toBe("work");
    for (const r of ranked) expect(r.score).toBeGreaterThanOrEqual(0.55);
  });

  it("filters below threshold", () => {
    const ranked = rankMatches("example.org", accounts);
    expect(ranked).toEqual([]);
  });

  it("returns Google account for accounts.google.com", () => {
    const ranked = rankMatches("accounts.google.com", accounts);
    expect(ranked[0].account.issuer).toBe("Google");
  });

  it("respects a custom threshold", () => {
    const permissive = rankMatches("aws.amazon.com", accounts, 0.4);
    expect(permissive.some((r) => r.account.issuer === "AWS")).toBe(true);
  });
});
