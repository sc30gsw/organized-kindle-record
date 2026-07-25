import { createCsrfMiddleware, createStart } from "@tanstack/react-start";

/**
 * server fn は同一オリジン RPC エンドポイントなので、クロスサイトからの POST を弾く。
 *
 * TanStack Start は start entry が存在しない間だけ既定の CSRF middleware を自動適用する
 * （createStartHandler の `hasStartInstance ? startOptions.requestMiddleware : [defaultCsrfMiddleware]`）。
 * つまりこのファイルを作った時点で自動適用は止まるため、既定と同じものを明示的に登録する。
 * ここから csrfMiddleware を外すと server fn が無防備になる。
 *
 * filter で serverFn に限定しているのは、通常のページ遷移や Notion OAuth のコールバック
 * （Sec-Fetch-Site: cross-site / none）まで弾いてしまわないようにするため。
 */
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
}));
