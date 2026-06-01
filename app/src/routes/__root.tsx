import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import appCss from "@/styles.css?url";
import "@mantine/core/styles.css";
// dropzone styles must come after core styles
import "@mantine/dropzone/styles.css";
import "@mantine/notifications/styles.css";
import "@xyflow/react/dist/style.css";

export const Route = createRootRoute({
  head: () => ({
    links: [{ rel: "stylesheet", href: appCss }],
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Kindle 読書記録" },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="ja" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <MantineProvider defaultColorScheme="light">
            <Notifications position="top-center" />
            <Outlet />
          </MantineProvider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
