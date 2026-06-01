import { TaggedError } from 'better-result';

/** 1 冊の同期（parse + Notion 反映）失敗。Notion SDK の throw を境界で包む。 */
export class BookSyncError extends TaggedError('BookSyncError')<{
  cause?: unknown;
  file: string;
  message: string;
}>() {}

/** アップロード RPC 全体の失敗（ネットワーク等）。 */
export class ImportRequestError extends TaggedError('ImportRequestError')<{
  cause?: unknown;
  message: string;
}>() {}
