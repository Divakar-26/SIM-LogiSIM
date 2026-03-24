import { memo, useRef, useState } from 'react';
import '../styles/node.css';
import Pin from "./Pin";
import { gateConfig } from '../configs/gates';
import { customComponentRegistry } from "../configs/customComponents";
import { getNodeSize } from "../utils/nodeSize";

// LOD (Level of Detail) - nodes render simplified below this screen size (pixels)
const LOD_WIDTH_THRESHOLD = 24;

function ClockFace({ active, size }) { 
    const r=size*0.32, cx=size/2, cy=size/2, wY=cy, seg=r*0.38;
    const wPath=[
        `M ${cx-r*0.7} ${wY}`, `L ${cx-r*0.7} ${wY-seg}`, `L ${cx-r*0.2} ${wY-seg}`,
        `L ${cx-r*0.2} ${wY+seg}`, `L ${cx+r*0.2} ${wY+seg}`, `L ${cx+r*0.2} ${wY-seg}`,
        `L ${cx+r*0.7} ${wY-seg}`, `L ${cx+r*0.7} ${wY}`,
    ].join(" ");
    return (
        <svg width={size} height={size} style={{position:"absolute",top:0,left:0,pointerEvents:"none"}}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={active?"#a6e3a1":"rgba(255,255,255,0.25)"} strokeWidth="1.5"/>
            <path d={wPath} fill="none" stroke={active?"#a6e3a1":"rgba(255,255,255,0.35)"} strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter"/>
            {active&&<circle cx={cx+r*0.7} cy={wY-seg} r="2.5" fill="#a6e3a1"/>}
        </svg>
    );
}

const Node = memo(function Node({
    id, type, x, y, value, label, hz, duty, outputs,
    nodeColor,
    cameraRef,
    workspaceRef, updateNodePosition, onPinClick, onBitToggle,
    selected, onSelect, onContextMenu, cancelWire, eraseMode,
    isLEDHovered, pauseTracking, resumeTracking, saveSnapshot,
    enableLOD,
}) {
    const dragStart  = useRef({x:0,y:0});
    const dragOffset = useRef({x:0,y:0});
    const dragging   = useRef(false);
    const [hovered, setHovered] = useState(false);

    const customComp = customComponentRegistry[type];
    const config = gateConfig[type] || {
        inputs:  customComp?.inputPinMap?.length  || 2,
        outputs: customComp?.outputPinMap?.length || 1,
    };
    const inputPinLabels  = customComp?.inputPinMap?.map(({nodeId})=>customComp.nodes.find(n=>n.id===nodeId)?.label||null)||[];
    const outputPinLabels = customComp?.outputPinMap?.map(({nodeId})=>customComp.nodes.find(n=>n.id===nodeId)?.label||null)||[];

    
    const handleMouseDown=(e)=>{
        if (e.button!==0) return;
        e.stopPropagation();
        const cam=cameraRef.current;
        const rect=workspaceRef.current.getBoundingClientRect();
        const mx=(e.clientX-rect.left-cam.x)/cam.zoom;
        const my=(e.clientY-rect.top -cam.y)/cam.zoom;
        dragStart.current ={x:mx,y:my};
        dragOffset.current={x:mx-x,y:my-y};
        dragging.current  =false;
        window.addEventListener('mousemove',onMove);
        window.addEventListener('mouseup',  onUp);
    };
    const onUp=(e)=>{
        if (!dragging.current) {
            if (type==='SWITCH') updateNodePosition(id,x,y,'toggle');
            onSelect(id, e);
        } else {
            // Only save history if we actually dragged
            resumeTracking && resumeTracking();
            saveSnapshot && saveSnapshot("Moved node");
        }
        dragging.current=false;
        window.removeEventListener('mousemove',onMove);
        window.removeEventListener('mouseup',  onUp);
    };
    const onMove=(e)=>{
        const cam=cameraRef.current;
        const rect=workspaceRef.current.getBoundingClientRect();
        const mx=(e.clientX-rect.left-cam.x)/cam.zoom;
        const my=(e.clientY-rect.top -cam.y)/cam.zoom;
        const dx=mx-dragStart.current.x, dy=my-dragStart.current.y;
        if (!dragging.current&&dx*dx+dy*dy>16) { 
            dragging.current=true; 
            cancelWire(); 
            pauseTracking && pauseTracking();
        }
        if (dragging.current) updateNodePosition(id,mx-dragOffset.current.x,my-dragOffset.current.y,null,selected);
    };

    const isClock    = type==='CLOCK';
    const isJunction = type==='JUNCTION';
    const isIO       = type==='SWITCH'||type==='LED'||isClock||isJunction;
    const isSwitch   = type==='SWITCH';
    const active     = value===1;

    const {width:nw,height:nh} = isJunction ? {width:10,height:10} : getNodeSize(type,config.inputs,config.outputs);
    
    // Calculate screen size for LOD
    const screenWidth = nw * cameraRef.current.zoom;
    const isSimplified = enableLOD && screenWidth < LOD_WIDTH_THRESHOLD;

    const borderStyle = isJunction ? 'none'
        : isClock   ? `1.5px solid ${active?'#89b4fa':'#2a4a6a'}`
        : isIO      ? '2px solid black'
        : '1px solid #555';

    return (
        <div style={{position:'absolute',left:x,top:y}}
            onMouseEnter={()=>setHovered(true)}
            onMouseLeave={()=>setHovered(false)}
        >
            <div
                className={`node node-${type.toLowerCase()}`}
                onMouseDown={handleMouseDown}
                onContextMenu={(e)=>{e.preventDefault();onContextMenu(e,id);}}
                style={{
                    width:nw, height:nh,
                    borderRadius:   isIO?'50%':'6px',
                    background:     nodeColor,
                    border:         borderStyle,
                    outline:        eraseMode&&hovered?'2px solid #f38ba8':selected?'2px solid #ffd166':'none',
                    boxShadow:      type==='LED'&&isLEDHovered?'0 0 12px 3px rgba(255, 200, 87, 0.6)':'none',
                    pointerEvents:  'auto',
                    position:       'relative',
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    overflow:       'visible',
                    cursor:         eraseMode?'crosshair':isJunction?'pointer':'default',
                    transition:     (isClock||isJunction)?'background 0.08s, border-color 0.08s':undefined,
                    boxSizing:      'border-box',
                }}
            >
                {}
                {!isJunction&&!isSimplified&&Array.from({length:config.inputs}).map((_,i)=>(
                    <Pin key={`in-${i}`} type="input" index={i} total={config.inputs}
                        nodeHeight={nh} nodeId={id} onPinClick={onPinClick}
                        label={inputPinLabels[i]||null}/>
                ))}

                {isClock&&!isSimplified&&<ClockFace active={active} size={nw}/>}

                {!isIO&&!isSimplified&&(
                    <span style={{fontSize:type.length>6?9:11,fontWeight:800,color:'#fff',letterSpacing:'0.06em',textTransform:'uppercase',userSelect:'none',pointerEvents:'none',textAlign:'center',padding:'0 14px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:nw-28,textShadow:'0 1px 3px rgba(0,0,0,0.8)'}}>
                        {type}
                    </span>
                )}

                {}
                {!isJunction&&!isSimplified&&Array.from({length:config.outputs}).map((_,i)=>(
                    <Pin key={`out-${i}`} type="output" index={i} total={config.outputs}
                        nodeHeight={nh} nodeId={id} onPinClick={onPinClick}
                        label={outputPinLabels[i]||null}/>
                ))}
            </div>

            {}
            {label&&!isJunction&&!isSimplified&&(
                <div style={{position:'absolute',whiteSpace:'nowrap',fontSize:'12px',fontWeight:500,color:'#f5f5f5',fontFamily:"'JetBrains Mono', monospace",pointerEvents:'none',userSelect:'none',opacity:hovered?1:0.75,transition:'opacity 0.15s',padding:'4px 8px',background:'rgba(0,0,0,0.6)',borderRadius:'4px',backdropFilter:'blur(2px)',border:'1px solid rgba(255,255,255,0.1)',
                    ...(isSwitch||isClock?{left:nw+12,top:'50%',transform:'translateY(-50%)'}:type==='LED'?{right:nw+12,top:'50%',transform:'translateY(-50%)'}:{top:nh+8,left:'50%',transform:'translateX(-50%)',fontSize:'11px'}),
                }}>{label}</div>
            )}

            {}
            {isClock&&!isSimplified&&(
                <div style={{position:'absolute',top:nh+4,left:'50%',transform:'translateX(-50%)',fontSize:10,fontFamily:"'JetBrains Mono', monospace",fontWeight:700,color:'#f5f5f5',whiteSpace:'nowrap',pointerEvents:'none',transition:'opacity 0.15s',opacity:hovered?1:0.6,padding:'2px 6px',background:'rgba(0,0,0,0.5)',borderRadius:'3px',border:'1px solid rgba(255,255,255,0.05)'}}>
                    {(hz??1)>=1?`${hz??1} Hz`:`${(hz??1).toFixed(1)} Hz`}
                </div>
            )}
        </div>
    );
}, (prev, next) =>
    prev.x         === next.x         &&
    prev.y         === next.y         &&
    prev.value     === next.value     &&
    prev.selected  === next.selected  &&
    prev.eraseMode === next.eraseMode &&
    prev.label     === next.label     &&
    prev.type      === next.type      &&
    prev.hz        === next.hz        &&
    prev.nodeColor === next.nodeColor &&
    prev.outputs   === next.outputs   &&
    prev.isLEDHovered === next.isLEDHovered &&
    prev.updateNodePosition === next.updateNodePosition &&
    prev.onPinClick         === next.onPinClick         &&
    prev.onSelect           === next.onSelect           &&
    prev.onContextMenu      === next.onContextMenu      &&
    prev.cancelWire         === next.cancelWire         &&
    prev.pauseTracking      === next.pauseTracking      &&
    prev.resumeTracking     === next.resumeTracking     &&
    prev.saveSnapshot       === next.saveSnapshot
); 

export default Node;  