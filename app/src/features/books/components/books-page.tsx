import { Suspense } from 'react';
import { ClientOnly } from '@tanstack/react-router';
import { Button, Container, Group, Loader, Stack, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { BooksSearchForm } from '@/features/books/components/books-search-form';
import { ImportModal } from '@/features/books/components/import-modal';
import { BooksTable } from '@/features/books/components/books-table';
import { useBooksQuery } from '@/features/books/hooks/use-books-query';

function BooksTableContainer() {
  const rows = useBooksQuery();

  return <BooksTable data={rows} />;
}

export function BooksPage() {
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <Container size="xl" py="md">
      <Stack>
        <Group justify="space-between">
          <Title order={2}>Kindle 読書記録</Title>
          <Button onClick={open}>取込</Button>
        </Group>
        <BooksSearchForm />
        <ClientOnly fallback={<Loader />}>
          <Suspense fallback={<Loader />}>
            <BooksTableContainer />
          </Suspense>
        </ClientOnly>
        <ImportModal opened={opened} onClose={close} />
      </Stack>
    </Container>
  );
}
