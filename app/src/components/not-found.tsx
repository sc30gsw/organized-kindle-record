import { Container, Text, Title } from "@mantine/core";

/** router の defaultNotFoundComponent。 */
export function NotFound() {
  return (
    <Container size="xl" py="xl">
      <Title order={2}>ページが見つかりません</Title>
      <Text c="dimmed" mt="sm">
        指定された URL のページは存在しません。
      </Text>
    </Container>
  );
}
