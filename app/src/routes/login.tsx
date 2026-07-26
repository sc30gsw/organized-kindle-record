import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Result } from "better-result";
import { Alert, Button, Card, Center, Stack, Text, Title } from "@mantine/core";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

// route ファイルは createFileRoute の Route（非 component）を export する規約のため構造上満たせない
// （project-structure.md の Routes exception）
// react-doctor-disable-next-line react-doctor/only-export-components
function LoginPage() {
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSignIn() {
    setIsPending(true);
    setErrorMessage(null);

    // reject（ネットワーク断など）もエラー応答と同じ扱いにする。
    // ここで包まないと、reject 時に isPending が下がらずボタンが永久に無効化される
    const outcome = await Result.tryPromise({
      try: () => authClient.signIn.social({ provider: "notion", callbackURL: "/" }),
      catch: (cause) => (cause instanceof Error ? cause.message : String(cause)),
    });

    const failure = Result.isError(outcome) ? outcome.error : outcome.value.error?.message;

    // 成功時は Notion へリダイレクトするので、isPending は下げずそのまま待たせる
    if (failure === undefined) {
      return;
    }

    // finally で下げてはいけない: 成功時に一瞬ボタンが有効化され、
    // リダイレクト待ちの間に二重クリックで OAuth を再開できてしまう。
    // reject は上の Result.tryPromise が失敗として拾うので、取りこぼしは無い
    // react-doctor-disable-next-line react-doctor/no-loading-flag-reset-outside-finally
    setIsPending(false);
    setErrorMessage(failure ?? "ログインを開始できませんでした。");
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
