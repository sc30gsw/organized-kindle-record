import { useRef, useState } from "react";
import { createLink } from "@tanstack/react-router";
import { Anchor, Image, Table, Text } from "@mantine/core";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { format } from "@formkit/tempo";
import { STATUS_COLOR, StatusBadge } from "@/features/books/components/status-badge";
import { BookRowValues } from "@/features/books/schemas/book-schema";

/** Mantine Anchor を TanStack Router の型付きリンクにする（to/params の型推論を維持）。 */
const TitleLink = createLink(Anchor);

const col = createColumnHelper<BookRowValues>();

const columns = [
  col.accessor("coverUrl", {
    header: "表紙",
    size: 56,
    enableSorting: false,
    cell: (c) =>
      c.getValue() ? (
        <Image src={c.getValue()!} alt="" w={40} h={56} fit="contain" />
      ) : (
        <Text c="dimmed" size="xs">
          —
        </Text>
      ),
  }),
  col.accessor("title", {
    header: "タイトル",
    size: 360,
    cell: (c) => (
      <TitleLink
        to="/books/$bookId"
        params={{ bookId: c.row.original.id }}
        truncate="end"
        title={c.getValue()}
        display="block"
      >
        {c.getValue()}
      </TitleLink>
    ),
  }),
  col.accessor("authors", {
    header: "著者",
    size: 160,
    enableSorting: false,
    cell: (c) => (
      <Text truncate="end" title={c.getValue().join(", ")}>
        {c.getValue().join(", ")}
      </Text>
    ),
  }),
  col.accessor("status", {
    header: "ステータス",
    size: 120,
    cell: (c) => <StatusBadge status={c.getValue() as keyof typeof STATUS_COLOR} />,
  }),
  col.accessor("amazonUrl", {
    header: "Amazon",
    size: 220,
    enableSorting: false,
    cell: (c) =>
      c.getValue() ? (
        <Anchor
          href={c.getValue()!}
          target="_blank"
          rel="noreferrer"
          truncate="end"
          title={c.getValue()!}
          display="block"
        >
          {c.getValue()}
        </Anchor>
      ) : null,
  }),
  col.accessor("pageUrl", {
    header: "Notion",
    size: 140,
    enableSorting: false,
    cell: (c) => (
      <Anchor href={c.getValue()} target="_blank" rel="noreferrer" size="sm">
        Notion で開く ↗
      </Anchor>
    ),
  }),
  col.accessor("highlightCount", { header: "ハイライト", size: 96 }),
  col.accessor("lastUpdated", {
    header: "最終更新",
    size: 116,
    cell: (c) => (c.getValue() ? format(c.getValue()!, "YYYY/MM/DD") : "—"),
  }),
];

export function BooksTable({ data }: Record<"data", BookRowValues[]>) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "lastUpdated", desc: true }]);
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 10,
  });

  return (
    <div ref={parentRef} style={{ height: "70vh", overflow: "auto" }}>
      <Table stickyHeader highlightOnHover layout="fixed">
        <Table.Thead>
          {table.getHeaderGroups().map((hg) => (
            <Table.Tr key={hg.id}>
              {hg.headers.map((h) => (
                <Table.Th
                  key={h.id}
                  onClick={h.column.getCanSort() ? h.column.getToggleSortingHandler() : undefined}
                  style={{
                    cursor: h.column.getCanSort() ? "pointer" : undefined,
                    width: h.getSize(),
                    backgroundColor: "var(--mantine-color-blue-0)",
                    color: "var(--mantine-color-blue-9)",
                  }}
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                  {({ asc: " ▲", desc: " ▼" } as Record<string, string>)[
                    h.column.getIsSorted() as string
                  ] ?? ""}
                </Table.Th>
              ))}
            </Table.Tr>
          ))}
        </Table.Thead>
        <Table.Tbody style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((vi) => {
            const row = rows[vi.index]!;
            const zebra = vi.index % 2 === 1;
            return (
              <Table.Tr
                key={row.id}
                data-index={vi.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  transform: `translateY(${vi.start}px)`,
                  width: "100%",
                  display: "table",
                  tableLayout: "fixed",
                  backgroundColor: zebra ? "var(--mantine-color-gray-0)" : undefined,
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <Table.Td key={cell.id} style={{ width: cell.column.getSize() }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </Table.Td>
                ))}
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </div>
  );
}
