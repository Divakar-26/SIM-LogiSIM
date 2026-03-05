function Wire({ x1, y1, x2, y2 , active}) {
  // If the wire is perfectly horizontal or vertical, draw a straight line
  if (x1 === x2 || y1 === y2) {
    return (
      <path
        d={`M ${x1} ${y1} L ${x2} ${y2}`}
        stroke={active ? "#ff0000" : "#aaa"}
        strokeWidth={active ? "3" : "2"}
        fill="none"
        strokeLinecap="round"
      />
    );
  }

  const midX = x1 + (x2 - x1) / 2;
  
  const radius = 5;
  

  const goingRight = x2 > x1;
  const goingDown = y2 > y1;
  
  let path;
  
  if (goingDown) {
    path = `
      M ${x1} ${y1}
      L ${midX - radius} ${y1}
      Q ${midX} ${y1} ${midX} ${y1 + radius}
      L ${midX} ${y2 - radius}
      Q ${midX} ${y2} ${midX + radius} ${y2}
      L ${x2} ${y2}
    `;
  } else {
    path = `
      M ${x1} ${y1}
      L ${midX - radius} ${y1}
      Q ${midX} ${y1} ${midX} ${y1 - radius}
      L ${midX} ${y2 + radius}
      Q ${midX} ${y2} ${midX + radius} ${y2}
      L ${x2} ${y2}
    `;
  }

  return (
    <path
      d={path}
      stroke={active ? "#ff0000" : "#aaa"}
      strokeWidth={active ? "3" : "2"}
      fill="none"
      strokeLinecap="round"
    />
  );
}

export default Wire;
