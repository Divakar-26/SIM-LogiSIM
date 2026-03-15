// src/components/Wire.jsx
// Perf: React.memo, colors/style as props (no useSettings subscription per wire),
//       waypoints support preserved from document-5.

import { memo } from 'react';

const Wire = memo(function Wire({ x1, y1, x2, y2, active, waypoints=[], activeColor, inactiveColor, wireStyle }) {
    const color = active ? activeColor : inactiveColor;
    const width = active ? 2.5 : 1.8;

    let path;
    if (waypoints.length>0||wireStyle==='straight') {
        const pts=[{x:x1,y:y1},...waypoints,{x:x2,y:y2}];
        path=pts.map((p,i)=>`${i===0?'M':'L'} ${p.x} ${p.y}`).join(' ');
    } else {
        const dx=x2-x1, s=Math.max(Math.abs(dx)*0.6,60);
        path=`M ${x1} ${y1} C ${x1+s} ${y1}, ${x2-s} ${y2}, ${x2} ${y2}`;
    }

    return (
        <g>
            {active&&<path d={path} stroke={activeColor} strokeWidth={6} fill="none" strokeLinecap="round" opacity={0.18}/>}
            <path d={path} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx={x1} cy={y1} r={2.5} fill={color}/>
            <circle cx={x2} cy={y2} r={2.5} fill={color}/>
            {waypoints.map((wp,i)=><circle key={i} cx={wp.x} cy={wp.y} r={2.5} fill={color}/>)}
        </g>
    );
}, (p,n) =>
    p.x1            === n.x1            &&
    p.y1            === n.y1            &&
    p.x2            === n.x2            &&
    p.y2            === n.y2            &&
    p.active        === n.active        &&
    p.activeColor   === n.activeColor   &&
    p.inactiveColor === n.inactiveColor &&
    p.wireStyle     === n.wireStyle     &&
    p.waypoints     === n.waypoints
);

export default Wire;