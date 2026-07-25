import { dash } from "@better-auth/infra";
import { betterAuth, User } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { db } from "@/lib/db";
import { account, session, user, verification } from "@/lib/db/auth-schema";
import { env } from "@/lib/env";

// env モジュールが空文字を弾いているため、ここでの長さチェックは不要
const allowedEmail = env.ALLOWED_NOTION_EMAIL.toLowerCase();

export function isAllowedEmail(email: User["email"]) {
  return (email ?? "").trim().toLowerCase() === allowedEmail;
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: { account, session, user, verification },
  }),
  socialProviders: {
    notion: {
      clientId: env.NOTION_CLIENT_ID,
      clientSecret: env.NOTION_CLIENT_SECRET,
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async ({ email }) => {
          if (!isAllowedEmail(email)) {
            throw new APIError("FORBIDDEN", {
              message:
                "このアプリは単一ユーザー専用です。許可されたアカウントでログインしてください。",
            });
          }
          return { data: user };
        },
      },
    },
  },
  plugins: [tanstackStartCookies(), dash({ apiKey: env.BETTER_AUTH_API_KEY })],
});
