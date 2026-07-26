import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeaders, setResponseStatus } from "@tanstack/react-start/server";
import { getAllowedSession } from "@/lib/auth";

/**
 * server fn の認証を型で強制するための middleware。
 *
 * server fn は素の HTTP エンドポイントなので、route の beforeLoad では守れない。
 * `.middleware([authMiddleware])` を付けた server fn だけが session を context から
 * 受け取れるようにして、「認証呼び出しを書き忘れる」経路を塞ぐ。
 */
export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const session = await getAllowedSession(getRequestHeaders());

  if (!session) {
    setResponseStatus(401);
    throw new Error("ログインが必要です。再度ログインしてください。");
  }

  return next({ context: { session } });
});
