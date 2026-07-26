import { Alert, Container } from "@mantine/core";

/** route の errorComponent 共通表示。一覧・詳細で同じ実装を持たないようにする。 */
export function RouteError({ error }: Record<"error", Error>) {
  return (
    <Container size="xl" py="md">
      <Alert color="red" title="読み込みエラー">
        {error.message}
      </Alert>
    </Container>
  );
}
