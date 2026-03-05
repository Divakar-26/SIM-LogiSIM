export function propagate(nodes, wires) {

  const nodeMap = new Map();
  nodes.forEach(n => nodeMap.set(n.id, { ...n }));

  const inputs = {};

  wires.forEach(w => {

    const fromNode = nodeMap.get(w.from.nodeId);

    if (!inputs[w.to.nodeId]) {
      inputs[w.to.nodeId] = [];
    }

    inputs[w.to.nodeId][w.to.index] = fromNode.value;
  });

  nodeMap.forEach(node => {

    if (node.type === "SWITCH") return;

    const expectedInputs = node.type === "NOT" ? 1 : (node.type === "LED" ? 1 : 2);

    const inVals = inputs[node.id] || [];

    const filledInputs = [];

    for (let i = 0; i < expectedInputs; i++) {
      filledInputs[i] = inVals[i] ?? 0;
    }

    switch (node.type) {

      case "AND":
        node.value = filledInputs[0] && filledInputs[1] ? 1 : 0;
        break;

      case "OR":
        node.value = filledInputs[0] || filledInputs[1] ? 1 : 0;
        break;

      case "NOT":
        node.value = filledInputs[0] ? 0 : 1;
        break;

      case "LED":
        node.value = filledInputs[0] ? 1 : 0;
        break;
    }

  });

  return Array.from(nodeMap.values());
}