import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Alert, Button, Card, Center, Stack, Text, Title } from "@mantine/core";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSignIn() {
    setIsPending(true);
    setErrorMessage(null);

    const { error } = await authClient.signIn.social({ provider: "notion", callbackURL: "/" });

    // 成功時は Notion へリダイレクトするため、ここに戻ってくるのは失敗した場合だけ
    if (error) {
      setIsPending(false);
      setErrorMessage(error.message ?? "ログインを開始できませんでした。");
    }
  }

  return (
    <Center mih="100dvh" p="md">
      <Card withBorder shadow="sm" radius="md" maw={380} p="xl" w="100%">
        <Stack align="center" gap="md">
          <Title order={2}>Kindle 読書記録</Title>
          <Text c="dimmed" size="sm" ta="center">
            続けるには Notion アカウントでログインしてください。
          </Text>
          {errorMessage ? (
            <Alert color="red" title="ログインできませんでした" w="100%">
              {errorMessage}
            </Alert>
          ) : null}
          <Button fullWidth loading={isPending} onClick={handleSignIn}>
            Notion でログイン
          </Button>
        </Stack>
      </Card>
    </Center>
  );
}
