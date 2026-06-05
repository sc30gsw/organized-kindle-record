import { useState } from "react";
import { getNodesBounds, getViewportForBounds, useReactFlow } from "@xyflow/react";
import { notifications } from "@mantine/notifications";
import { Result } from "better-result";
import { domToBlob } from "modern-screenshot";

/** 出力解像度の倍率（Retina 相当の 2x） */
const EXPORT_SCALE = 2;
/** ノード群の周囲に確保する余白（getViewportForBounds の padding 比率） */
const EXPORT_PADDING = 0.1;
/** 出力画像の最小辺長（px）。ノードが少なくても潰れないようにする */
const MIN_EXPORT_PX = 320;
/** 出力画像の最大辺長（px）。ブラウザの canvas 上限（約16,000px）を超えると描画が壊れるため安全圏に抑える */
const MAX_EXPORT_PX = 8192;

/**
 * エクスポート中だけエッジ線を太くする CSS を注入して run を実行する。
 * 巨大マップは zoom < 1 で縮小描画され、1px のエッジ線がヘアライン化して PNG 上で消えるため、
 * 画像上でおおよそ 2px になるよう逆補正する（画面表示には影響しない）。
 */
function withBoostedEdgeStroke<T>(zoom: number, run: () => Promise<T>): Promise<T> {
  const styleEl = document.createElement("style");
  styleEl.textContent = `.react-flow__edge-path { stroke-width: ${Math.max(1, 2 / zoom)}px !important; }`;
  document.head.append(styleEl);
  return run().finally(() => {
    styleEl.remove();
  });
}

/** マインドマップ全体を PNG 化してダウンロード / クリップボードコピーするフック。ReactFlowProvider 内で使うこと。 */
export function useExportImage() {
  const { getNodes } = useReactFlow();
  const [exporting, setExporting] = useState(false);

  /** 全ノードが収まる画角で flow ペインを PNG Blob 化する */
  function renderPng() {
    const viewportEl = document.querySelector<HTMLElement>(".react-flow__viewport");
    const nodes = getNodes();
    if (!viewportEl || nodes.length === 0) {
      return Promise.resolve(Result.err(new Error("エクスポート対象のノードがありません")));
    }

    const bounds = getNodesBounds(nodes);
    // 大きなマップでは倍率を自動で落とし、canvas 上限超過による劣化・描画破綻を防ぐ
    const scale = Math.min(
      EXPORT_SCALE,
      MAX_EXPORT_PX / Math.max(bounds.width, 1),
      MAX_EXPORT_PX / Math.max(bounds.height, 1),
    );
    const width = Math.max(MIN_EXPORT_PX, Math.round(bounds.width * scale));
    const height = Math.max(MIN_EXPORT_PX, Math.round(bounds.height * scale));
    const viewport = getViewportForBounds(
      bounds,
      width,
      height,
      0.01,
      EXPORT_SCALE,
      EXPORT_PADDING,
    );

    return Result.tryPromise({
      try: () =>
        withBoostedEdgeStroke(viewport.zoom, async () => {
          // html-to-image はエッジ SVG を取りこぼすため、修正済みフォークの modern-screenshot を使う
          const blob = await domToBlob(viewportEl, {
            backgroundColor: "#ffffff",
            // 暗黙の再拡大をしない（width/height で明示制御済み）
            scale: 1,
            width,
            height,
            style: {
              width: `${width}px`,
              height: `${height}px`,
              transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
            },
          });
          if (!blob) {
            throw new Error("blob generation returned null");
          }
          return blob;
        }),
      catch: (cause) => new Error("画像の生成に失敗しました", { cause }),
    });
  }

  /** PNG を `{fileName}.png` としてダウンロードする */
  async function downloadPng(fileName: string) {
    setExporting(true);
    const result = await renderPng();
    setExporting(false);

    if (Result.isError(result)) {
      notifications.show({
        title: "エクスポート失敗",
        message: result.error.message,
        color: "red",
      });
      return;
    }

    const url = URL.createObjectURL(result.value);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${fileName}.png`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  /** PNG をクリップボードにコピーする（Slack 等へ直貼り用） */
  async function copyPng() {
    setExporting(true);
    const blobResult = await renderPng();

    if (Result.isError(blobResult)) {
      setExporting(false);
      notifications.show({
        title: "エクスポート失敗",
        message: blobResult.error.message,
        color: "red",
      });
      return;
    }

    const writeResult = await Result.tryPromise({
      try: () => navigator.clipboard.write([new ClipboardItem({ "image/png": blobResult.value })]),
      catch: (cause) => new Error("クリップボードへのコピーに失敗しました", { cause }),
    });
    setExporting(false);

    if (Result.isError(writeResult)) {
      notifications.show({
        title: "コピー失敗",
        message: writeResult.error.message,
        color: "red",
      });
      return;
    }

    notifications.show({ message: "画像をクリップボードにコピーしました", color: "teal" });
  }

  return { exporting, downloadPng, copyPng };
}
