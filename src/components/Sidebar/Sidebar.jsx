import { sidebarItems } from "../../configs/gates";
import "../../styles/sidebar.css"

function Sidebar({ addNode }) {

  return (
    <div className="sidebar">
      <h3>Components</h3>

      {sidebarItems.map((item) => (
        <div
          key={item}
          className="sidebar-item"
          onClick={() => addNode(item)}
        >
          {item}
        </div>
      ))}
    </div>
  );
}

export default Sidebar;