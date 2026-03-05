import "../styles/Pin.css";

function Pin({ type, index, total, nodeId, onPinClick }) {

  const spacing = 100 / (total + 1);
  const top = spacing * (index + 1);

  const handleStart = (e) => {
    e.stopPropagation();

    if (type === "output") {
      onPinClick({ nodeId, type, index, total });
    }
  };

  const handleEnd = (e) => {
    e.stopPropagation();

    if (type === "input") {
      onPinClick({ nodeId, type, index, total });
    }
  };

  return (
    <div
      className={`pin pin-${type}`}
      style={{ top: `${top}%` }}
      onMouseDown={handleStart}
      onMouseUp={handleEnd}
    />
  );
}

export default Pin;