import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { getAllowedSession } from "@/lib/auth";

/**
 * route の beforeLoad 専用。未ログインを null で返し、呼び出し側が /login へ redirect する。
 * server fn の認証は auth-middleware の authMiddleware が担う（こちらを呼んではいけない）。
 */
export const getSession = createServerFn({ method: "GET" }).handler(async () =>
  getAllowedSession(getRequestHeaders()),
);
