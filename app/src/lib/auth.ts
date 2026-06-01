import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LibsqlDialect } from "@libsql/kysely-libsql";
import { betterAuth, User } from "better-auth";
import { APIError } from "better-auth/api";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import dotenv from "dotenv";

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

const allowedEmail = (process.env["ALLOWED_NOTION_EMAIL"] ?? "").trim().toLowerCase();

export function isAllowedEmail(email: User["email"]) {
  return allowedEmail.length > 0 && (email ?? "").trim().toLowerCase() === allowedEmail;
}
const databaseUrl = process.env["TURSO_DATABASE_URL"];
const databaseAuthToken = process.env["TURSO_AUTH_TOKEN"];

if (!databaseUrl || !databaseAuthToken) {
  throw new Error("TURSO_DATABASE_URL or TURSO_AUTH_TOKEN is not set");
}

export const auth = betterAuth({
  database: {
    dialect: new LibsqlDialect({ url: databaseUrl, authToken: databaseAuthToken }),
    type: "sqlite",
  },
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
