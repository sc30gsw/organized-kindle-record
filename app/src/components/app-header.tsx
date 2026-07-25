import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { Button, Group, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconLogout } from "@tabler/icons-react";
import { authClient } from "@/lib/auth-client";

/** ログイン中のアカウント表示とログアウト導線。認証済みレイアウト全体で共有する。 */
export function AppHeader({ email }: Record<"email", string>) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);

    const { error } = await authClient.signOut();

    if (error) {
      setIsSigningOut(false);
      notifications.show({
        title: "ログアウトに失敗しました",
        message: error.message ?? "時間をおいて再度お試しください。",
        color: "red",
      });
      return;
    }

    // beforeLoad を再評価させて /login へ送る
    await router.invalidate();
    await router.navigate({ to: "/login" });
  }

  return (
    <Group component="header" justify="space-between" px="md" py="xs" wrap="nowrap">
      <Text
        c="inherit"
        fw={600}
        renderRoot={(props) => <Link to="/" {...props} />}
        style={{ textDecoration: "none" }}
      >
        Kindle 読書記録
      </Text>
      <Group gap="sm" wrap="nowrap">
        <Text c="dimmed" size="sm" truncate="end">
          {email}
        </Text>
        <Button
          leftSection={<IconLogout size={16} />}
          loading={isSigningOut}
          onClick={handleSignOut}
          size="compact-sm"
          variant="subtle"
        >
          ログアウト
        </Button>
      </Group>
    </Group>
  );
}
