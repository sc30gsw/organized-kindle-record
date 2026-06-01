import { createFileRoute } from '@tanstack/react-router';
import { Button, Card, Center, Stack, Text, Title } from '@mantine/core';
import { authClient } from '@/lib/auth-client';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

function LoginPage() {
  return (
    <Center mih="100dvh" p="md">
      <Card withBorder shadow="sm" radius="md" maw={380} p="xl" w="100%">
        <Stack align="center" gap="md">
          <Title order={2}>Kindle 読書記録</Title>
          <Text c="dimmed" size="sm" ta="center">
            続けるには Notion アカウントでログインしてください。
          </Text>
          <Button
            fullWidth
            onClick={() => authClient.signIn.social({ provider: 'notion', callbackURL: '/' })}
          >
            Notion でログイン
          </Button>
        </Stack>
      </Card>
    </Center>
  );
}
