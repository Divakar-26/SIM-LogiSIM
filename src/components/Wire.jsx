function Wire({ x1, y1, x2, y2 }) {

  const midX = x1 + (x2 - x1) / 2;
  const r = 10;

  const goingDown = y2 > y1;

  const path = goingDown
    ? `
      M ${x1} ${y1}
      L ${midX - r} ${y1}
      Q ${midX} ${y1} ${midX} ${y1 + r}
      L ${midX} ${y2 - r}
      Q ${midX} ${y2} ${midX + r} ${y2}
      L ${x2} ${y2}
    `
    : `
      M ${x1} ${y1}
      L ${midX - r} ${y1}
      Q ${midX} ${y1} ${midX} ${y1 - r}
      L ${midX} ${y2 + r}
      Q ${midX} ${y2} ${midX + r} ${y2}
      L ${x2} ${y2}
    `;

  return (
    <path
      d={path}
      stroke="white"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
    />
  );
}

export default Wire;
