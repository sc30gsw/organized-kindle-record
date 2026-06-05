import {
  Background,
  ConnectionMode,
  Controls,
  MiniMap,
  NodeTypes,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type Node,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
  type ReactFlowInstance,
} from "@xyflow/react";
import { Stack } from "@mantine/core";
import { TitleNode } from "@/features/mind-map/components/nodes/title-node";
import { TextNode } from "@/features/mind-map/components/nodes/text-node";
import { MindMapToolbar } from "@/features/mind-map/components/mind-map-toolbar";
import type { WheelMode } from "@/features/mind-map/schemas/wheel-mode-schema";

const nodeTypes = { title: TitleNode, text: TextNode } as const satisfies NodeTypes;

type MindMapCanvasProps = {
  exportFileName: string;
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onReconnect: (oldEdge: Edge, newConnection: Connection) => void;
  onInit: (rf: ReactFlowInstance<Node, Edge>) => void;
  onAddNode: () => void;
  onWheelModeChange: (mode: WheelMode) => void;
  wheelMode: WheelMode;
};

function Canvas({
  exportFileName,
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onReconnect,
  onInit,
  onAddNode,
  onWheelModeChange,
  wheelMode,
}: MindMapCanvasProps) {
  return (
    <Stack gap={0} h="100%">
      <MindMapToolbar
        exportFileName={exportFileName}
        onAddNode={onAddNode}
        onWheelModeChange={onWheelModeChange}
        wheelMode={wheelMode}
      />
      <div className="min-h-0 flex-1 overscroll-contain">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onReconnect={onReconnect}
          onInit={onInit}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          panOnScroll={wheelMode === "pan"}
          zoomOnScroll={wheelMode === "zoom"}
          fitView
        >
          <Background />
          <Controls position="top-right" />
          <MiniMap />
        </ReactFlow>
      </div>
    </Stack>
  );
}

export function MindMapCanvas(props: MindMapCanvasProps) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}
