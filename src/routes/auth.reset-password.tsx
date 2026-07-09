import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useLingui } from "@lingui/react";
import { supabase } from "@/integrations/supabase/client";
import { KeyRound, Lock } from "lucide-react";
import {
  AegisScreen,
  BrandBar,
  Display,
  Eyebrow,
  Field,
  HeroIcon,
  Lede,
  Notice,
  PrimaryButton,
  MUTED,
  inputClass,
  inputStyle,
} from "@/components/aegis/chrome";

export const Route = createFileRoute("/auth/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset your Aegis password" },
      {
        name: "description",
        content:
          "Choose a new password for your Aegis account. Your encrypted vault stays untouched.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Reset your Aegis password" },
      {
        property: "og:description",
        content: "Set a new password on your Aegis account.",
      },
      { property: "og:url", content: "https://hug-machine-maker.lovable.app/auth/reset-password" },
    ],
  }),
  component: ResetPasswordPage,
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center p-6 text-sm">{error.message}</div>
  ),
  notFoundComponent: () => <NotFoundView />,
});

function NotFoundView() {
  const { i18n } = useLingui();
  const msg = i18n._("auth.notFound");
  return <div className="p-6 text-sm">{msg === "auth.notFound" ? "Not found" : msg}</div>;
}

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { i18n } = useLingui();
  const t = (id: string, fallback: string) => {
    const m = i18n._(id);
    return m === id ? fallback : m;
  };
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setNotice({ kind: "info", text: t("authReset.success", "Password updated. Redirecting…") });
      setTimeout(() => navigate({ to: "/", replace: true }), 800);
    } catch (err) {
      setNotice({
        kind: "error",
        text: err instanceof Error ? err.message : t("authReset.error", "Could not update password."),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AegisScreen>
      <BrandBar />
      <div className="flex flex-1 flex-col justify-center gap-6">
        <div className="flex flex-col items-start gap-4">
          <HeroIcon Icon={KeyRound} />
          <div className="flex flex-col gap-2.5">
            <Eyebrow>{t("authReset.eyebrow", "New password")}</Eyebrow>
            <Display>{t("authReset.title", "Set a new password.")}</Display>
            <Lede>{t("authReset.subtitle", "Choose something you'll remember — at least 8 characters.")}</Lede>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
          <Field icon={<Lock className="h-4 w-4" strokeWidth={1.6} />} delay={0.05}>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder={t("authReset.placeholder", "New password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
          </Field>

          {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

          <div className="pt-1">
            <PrimaryButton type="submit" loading={loading} disabled={!ready}>
              {t("authReset.button", "Update password")}
            </PrimaryButton>
          </div>
          {!ready && (
            <p className="text-center text-[12px]" style={{ color: MUTED }}>
              {t("authReset.waiting", "Waiting for a valid reset link…")}
            </p>
          )}
        </form>
      </div>
    </AegisScreen>
  );
}
