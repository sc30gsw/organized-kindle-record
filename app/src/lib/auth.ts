import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { betterAuth, User } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import dotenv from "dotenv";
import { db } from "@/lib/db";
import { account, session, user, verification } from "@/lib/db/auth-schema";

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

const allowedEmail = (process.env["ALLOWED_NOTION_EMAIL"] ?? "").trim().toLowerCase();

export function isAllowedEmail(email: User["email"]) {
  return allowedEmail.length > 0 && (email ?? "").trim().toLowerCase() === allowedEmail;
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: { account, session, user, verification },
  }),
  socialProviders: {
    notion: {
      clientId: process.env["NOTION_CLIENT_ID"] ?? "",
      clientSecret: process.env["NOTION_CLIENT_SECRET"] ?? "",
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!isAllowedEmail(user.email)) {
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
  plugins: [tanstackStartCookies()],
});
