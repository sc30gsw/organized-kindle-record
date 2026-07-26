export type ImportResultIdentity = {
  /** List のキー。ファイル名は重複しうるので、表示ラベルとは別に安定 id を持つ。 */
  id: string;
  /** 表示ラベル。ファイル取込はファイル名、ペースト取込は書名。 */
  file: string;
};

/** 取込 1 件ぶんの結果（例外は投げず判別共用体で返す）。 */
export type ImportFileResult = ImportResultIdentity &
  (
    | { kind: "created"; added: number }
    | { kind: "updated"; added: number }
    | { kind: "unchanged" }
    | { kind: "skipped"; reason: string }
    | { kind: "failed"; error: string }
  );
