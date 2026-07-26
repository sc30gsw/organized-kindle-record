import { dash } from "@better-auth/infra";
import { betterAuth, type User } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { db } from "@/lib/db";
import { account, session, user, verification } from "@/lib/db/auth-schema";
import { env } from "@/lib/env";

// env モジュールが空文字を弾いているため、ここでの長さチェックは不要
const allowedEmail = env.ALLOWED_NOTION_EMAIL.toLowerCase();

/** 許可アカウント判定。このモジュールの外へは出さず、必ず getAllowedSession 経由で使う。 */
function isAllowedEmail(email: User["email"]) {
  return (email ?? "").trim().toLowerCase() === allowedEmail;
}

/** セッション設定の TTL（秒）。cookieCache のためリクエスト毎の DB 参照を避ける。 */
const SESSION_COOKIE_CACHE_MAX_AGE_SEC = 300;

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [env.BETTER_AUTH_URL],
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: { account, session, user, verification },
  }),
  session: {
    // 1 ページロードで getSession が複数回走るため、短時間だけ Cookie にキャッシュして
    // Turso への session/user 参照を実質 1 回に落とす。失効の反映は最大 maxAge 秒遅れる。
    cookieCache: { enabled: true, maxAge: SESSION_COOKIE_CACHE_MAX_AGE_SEC },
  },
  socialProviders: {
    notion: {
      clientId: env.NOTION_CLIENT_ID,
      clientSecret: env.NOTION_CLIENT_SECRET,
    },
  },
  databaseHooks: {
    user: {
      create: {
        // 許可アカウント以外の新規作成を止めるだけのゲート。
        // better-auth は戻り値 { data } を作成データへ **マージ** するため、
        // 加工が不要なら何も返さない（返すと返した値で上書きされる）。
        before: async (newUser) => {
          if (!isAllowedEmail(newUser.email)) {
            throw new APIError("FORBIDDEN", {
              message:
                "このアプリは単一ユーザー専用です。許可されたアカウントでログインしてください。",
            });
          }
        },
      },
    },
  },
  plugins: [tanstackStartCookies(), dash({ apiKey: env.BETTER_AUTH_API_KEY })],
});

/**
 * このアプリで有効と見なせるセッションだけを返す（許可アカウント判定を含む）。
 * セッションの読み出し口をここ 1 箇所に閉じ、「判定を書き忘れる」経路をなくす。
 */
export async function getAllowedSession(headers: Headers) {
  const current = await auth.api.getSession({ headers });

  return current && isAllowedEmail(current.user.email) ? current : null;
}
