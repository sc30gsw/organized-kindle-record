import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { AppHeader } from "@/components/app-header";
import { getSession } from "@/lib/auth-functions";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const session = await getSession();
    if (!session) {
      throw redirect({ to: "/login" });
    }

    return { user: session.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();

  return (
    // ヘッダー + 残り全部の 2 段。各ページは h-full で「残り」を基準にできるので、
    // 100vh からヘッダー高さを引くような決め打ちが要らない
    <div className="flex h-dvh flex-col">
      <AppHeader email={user.email} />
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
