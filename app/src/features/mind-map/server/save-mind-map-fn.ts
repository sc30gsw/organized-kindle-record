import { createServerFn } from "@tanstack/react-start";
import { Result, TaggedError } from "better-result";
import * as v from "valibot";
import { ensureSession } from "@/lib/auth-functions";
import { db } from "@/lib/db";
import { mindMap } from "@/lib/db/schema";
import { mindMapGraphSchema } from "@/features/mind-map/schemas/mind-map-schema";

class MindMapSaveError extends TaggedError("MindMapSaveError")<{
  cause?: unknown;
  message: string;
}>() {}

const saveInput = v.object({
  bookId: v.string(),
  graph: mindMapGraphSchema,
});

/** 1 冊分のマインドマップを upsert する。userId / updatedAt はサーバー側で確定。 */
export const saveMindMapFn = createServerFn({ method: "POST" })
  .inputValidator(saveInput)
  .handler(async ({ data }) => {
    const session = await ensureSession();
    const now = Date.now();

    const saved = await Result.tryPromise({
      try: () =>
        db
          .insert(mindMap)
          .values({
            bookId: data.bookId,
            userId: session.user.id,
            graph: data.graph,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: mindMap.bookId,
            set: { graph: data.graph, updatedAt: now, userId: session.user.id },
          }),
      catch: (cause) =>
        new MindMapSaveError({
          cause,
          message: cause instanceof Error ? cause.message : String(cause),
        }),
    });

    if (Result.isError(saved)) {
      return { ok: false, message: saved.error.message };
    }

    return { ok: true, updatedAt: now };
  });
