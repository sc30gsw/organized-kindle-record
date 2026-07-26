import { Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { Button, Container, Group, Stack, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { BooksSearchForm } from "@/features/books/components/books-search-form";
import { ImportModal } from "@/features/books/components/import-modal";
import { BooksTable } from "@/features/books/components/books-table";
import { useBooksQuery } from "@/features/books/hooks/use-books-query";
import { PageLoader } from "@/components/page-loader";

function BooksTableContainer() {
  const rows = useBooksQuery();

  return <BooksTable data={rows} />;
}

export function BooksPage() {
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <Container className="flex h-full flex-col" size="xl" py="md">
      <Stack className="min-h-0 flex-1">
        <Group justify="space-between">
          <Title order={2}>Kindle 読書記録</Title>
          <Button onClick={open}>取込</Button>
        </Group>
        <BooksSearchForm />
        {/* 表だけがスクロールする領域。高さは親（レイアウトの残り）から決まる */}
        <div className="min-h-0 flex-1">
          <ClientOnly fallback={<PageLoader />}>
            <Suspense fallback={<PageLoader />}>
              <BooksTableContainer />
            </Suspense>
          </ClientOnly>
        </div>
        <ImportModal opened={opened} onClose={close} />
      </Stack>
    </Container>
  );
}
