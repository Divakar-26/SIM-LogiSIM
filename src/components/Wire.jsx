function Wire({ x1, y1, x2, y2, active }) {

  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Control point strength scales with distance but has a minimum
  // This makes short wires tight and long wires graceful
  const strength = Math.max(Math.abs(dx) * 0.6, 60);

  // Cubic bezier: exit horizontally from output pin, enter horizontally into input pin
  const cp1x = x1 + strength;
  const cp1y = y1;
  const cp2x = x2 - strength;
  const cp2y = y2;

  const path = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;

  const color = active ? "#ff4444" : "#555e6e";
  const width = active ? 2.5 : 1.8;

  return (
    <g>
      {/* Glow layer for active wires */}
      {active && (
        <path
          d={path}
          stroke="#ff2222"
          strokeWidth={6}
          fill="none"
          strokeLinecap="round"
          opacity={0.2}
        />
      )}

      {/* Main wire */}
      <path
        d={path}
        stroke={color}
        strokeWidth={width}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round" 
      />

      {/* Dots at endpoints */}
      <circle cx={x1} cy={y1} r={2.5} fill={color} />
      <circle cx={x2} cy={y2} r={2.5} fill={color} />
    </g>
  );
}

export default Wire;