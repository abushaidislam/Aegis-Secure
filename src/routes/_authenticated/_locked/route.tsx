import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { isVaultUnlocked } from "@/lib/vault-session";

export const Route = createFileRoute("/_authenticated/_locked")({
  beforeLoad: ({ location }) => {
    if (!isVaultUnlocked()) {
      throw redirect({
        to: "/lock",
        search: { redirect: location.href },
      });
    }
  },
  component: () => <Outlet />,
});
