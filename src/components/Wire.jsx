// src/components/Wire.jsx

import { useSettings } from "../configs/SettingsContext";

function Wire({ x1, y1, x2, y2, active, waypoints = [] }) {
  const { settings } = useSettings();
  const { wireActiveColor, wireInactiveColor, wireStyle } = settings;

  const color = active ? wireActiveColor : wireInactiveColor;
  const width = active ? 2.5 : 1.8;

  let path;
  if (waypoints.length > 0 || wireStyle === "straight") {
    // Straight segments through every waypoint
    const pts = [{ x: x1, y: y1 }, ...waypoints, { x: x2, y: y2 }];
    path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  } else {
    // Smooth bezier (default, no waypoints)
    const dx = x2 - x1;
    const strength = Math.max(Math.abs(dx) * 0.6, 60);
    path = `M ${x1} ${y1} C ${x1 + strength} ${y1}, ${x2 - strength} ${y2}, ${x2} ${y2}`;
  }

  return (
    <g>
      {active && (
        <path d={path} stroke={wireActiveColor} strokeWidth={6}
          fill="none" strokeLinecap="round" opacity={0.18} />
      )}
      <path d={path} stroke={color} strokeWidth={width}
        fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* Endpoint dots */}
      <circle cx={x1} cy={y1} r={2.5} fill={color} />
      <circle cx={x2} cy={y2} r={2.5} fill={color} />
      {/* Waypoint dots */}
      {waypoints.map((wp, i) => (
        <circle key={i} cx={wp.x} cy={wp.y} r={2.5} fill={color} />
      ))}
    </g>
  );
}

export default Wire;