import { createRouter } from '@tanstack/react-router';
import { Container, Text, Title } from '@mantine/core';
import { routeTree } from './routeTree.gen';

function NotFound() {
  return (
    <Container size="xl" py="xl">
      <Title order={2}>ページが見つかりません</Title>
      <Text c="dimmed" mt="sm">
        指定された URL のページは存在しません。
      </Text>
    </Container>
  );
}

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultNotFoundComponent: NotFound,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
