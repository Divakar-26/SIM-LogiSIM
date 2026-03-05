import { useState } from 'react'
import Sidebar from './components/Sidebar/Sidebar.jsx'
import Workspace from './components/Workspace/Workspace.jsx'

function App() {

  const [nodes, setNodes] = useState([
    { id: 1, type: "SWITCH", x: 120, y: 200, value: 1 },
    { id: 2, type: "AND", x: 350, y: 150, value: 0 },
    { id: 3, type: "LED", x: 600, y: 200, value: 0 },
  ]);

  const addNode = (type) => {
    const newNode = {
      id: Date.now(),
      type: type,
      x: 200,
      y: 200
    };

    setNodes(prev => [...prev, newNode]);
  };


  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <Sidebar addNode={addNode} />
      <Workspace nodes={nodes} setNodes={setNodes} />
    </div>
  );
}

export default App;