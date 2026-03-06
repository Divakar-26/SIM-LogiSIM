import { sidebarItems } from "../../configs/gates";
import "../../styles/sidebar.css"

function Sidebar({ addNode, onSaveCircuit, savedNames = [], onRenameComponent, onDeleteComponent }) {

    return (
        <div className="sidebar">

            <h3>Gates</h3>

            <div className="sidebar-scroll">
                {sidebarItems.map((item) => (
                    <div
                        key={item}
                        className="sidebar-item"
                        onClick={() => addNode(item)}
                    >
                        {item}
                    </div>
                ))}

                {savedNames.length > 0 && (
                    <>
                        <div className="sidebar-section-label">Saved</div>
                        {savedNames.map(name => (
                            <div
                                key={name}
                                className="sidebar-item sidebar-item-custom"
                                onClick={() => addNode(name)}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    // show context menu relative to sidebar
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    onRenameComponent && onRenameComponent(name, e.clientX, e.clientY);
                                }}
                            >
                                <span className="sidebar-item-icon">📦</span>
                                <span className="sidebar-item-name">{name}</span>
                                <button
                                    className="sidebar-item-menu-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRenameComponent && onRenameComponent(name, e.clientX, e.clientY);
                                    }}
                                    title="Options"
                                >⋯</button>
                            </div>
                        ))}
                    </>
                )}
            </div>

            <button className="sidebar-save" onClick={onSaveCircuit}>
                💾 Save Circuit
            </button>

        </div>
    );
}

export default Sidebar;