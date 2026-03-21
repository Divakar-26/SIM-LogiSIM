// Single source of truth for node dimensions — used by Node.jsx and pinPosition.js

const PIN_SPACING = 22;  // px between pin centers
const PIN_MARGIN  = 14;  // px above first pin and below last pin
const MIN_HEIGHT  = 40;
const CHAR_WIDTH  = 8;
const LABEL_PAD   = 44;  // left + right padding around label text

export function getNodeSize(type, inputCount, outputCount) {
    const isIO = type === "SWITCH" || type === "LED";
    if (isIO) return { width: 28, height: 28 };
 
    const maxPins  = Math.max(inputCount, outputCount, 1);
    const textW    = type.length * CHAR_WIDTH + LABEL_PAD; 
    const pinH     = maxPins * PIN_SPACING + PIN_MARGIN * 2;
    const width    = Math.max(textW, 60);
    const height   = Math.max(MIN_HEIGHT, pinH);
    return { width, height };
}

// Y coordinate (relative to node top) for pin at index i out of total
export function pinY(index, total, nodeHeight) {
    const spacing = nodeHeight / (total + 1);
    return spacing * (index + 1);
} 