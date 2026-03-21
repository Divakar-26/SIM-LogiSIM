import { getNodeSize, pinY } from "./nodeSize";
import { gateConfig } from "../configs/gates";
import { customComponentRegistry } from "../configs/customComponents";

export function getPinPosition(node, pin, isOutput) {
    const isIO = node.type === "SWITCH" || node.type === "LED";
    if (isIO) {
        return {
            x: isOutput ? node.x + 28 : node.x,
            y: node.y + 14,  // center of 28px circle
        };
    }

    const cfg = gateConfig[node.type] || {
        inputs:  customComponentRegistry[node.type]?.inputPinMap?.length  || 2,
        outputs: customComponentRegistry[node.type]?.outputPinMap?.length || 1,
    };

    const { width, height } = getNodeSize(node.type, cfg.inputs, cfg.outputs);
    const total = isOutput ? cfg.outputs : cfg.inputs;
    const y = node.y + pinY(pin.index, total, height);
    const x = isOutput ? node.x + width : node.x;
    return { x, y };
}   