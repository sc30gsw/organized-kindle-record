import { Handle, Position } from "@xyflow/react";

/**
 * 4方向の接続ハンドル。connectionMode: loose 前提でどのハンドル同士でも接続できる。
 * 上下は既存エッジ（sourceHandle/targetHandle が null）との互換のため id なしのまま。
 */
export function NodeHandles() {
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
      <Handle id="left" type="source" position={Position.Left} />
      <Handle id="right" type="source" position={Position.Right} />
    </>
  );
}
