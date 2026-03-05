export function getPinPosition(node, pin, isOutput) {

  const isIO = node.type === "SWITCH" || node.type === "LED";

  const NODE_WIDTH = isIO ? 28 : 80;
  const NODE_HEIGHT = isIO ? 28 : 40;

  const spacing = NODE_HEIGHT / (pin.total + 1);

  const y = node.y + spacing * (pin.index + 1);

  const x = isOutput
      ? node.x + NODE_WIDTH
      : node.x;

  return { x, y };
}