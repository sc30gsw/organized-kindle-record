import {
  Background,
  Controls,
  MiniMap,
  NodeTypes,
  ReactFlow,
  ReactFlowProvider,
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

const nodeTypes = { title: TitleNode, text: TextNode } as const satisfies NodeTypes;

type MindMapCanvasProps = {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onInit: (rf: ReactFlowInstance<Node, Edge>) => void;
  onAddNode: () => void;
};

function Canvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onInit,
  onAddNode,
}: MindMapCanvasProps) {
  return (
    <Stack gap={0} h="100%">
      <MindMapToolbar onAddNode={onAddNode} />
      <div style={{ flex: 1, minHeight: 0 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={onInit}
          nodeTypes={nodeTypes}
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
