
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import '../../styles/workspace.css';
import Node from "../Node";
import Wire from "../Wire";
import { getPinPosition } from "../../utils/pinPosition";
import { getVisibleNodes, getVisibleWires } from "../../utils/viewportCulling";
import { useHistoryState } from "../../hooks/useHistoryState";
import { propagate } from "./propagate";
import TruthTablePanel from "./TruthTablePanel";
import ClockConfig from "./ClockConfig";
import { LEDDecimalConverterPanelWrapper, LEDDecimalConverterFullWrapper, LEDDecimalConverterDisplay, LEDDecimalConverterDisplayWrapper, useLEDDecimalConverter } from "./LEDDecimalConverter";
import { useSettings } from "../../configs/SettingsContext";
import { syncClocks, setClockChangeHandler, stopAllClocks } from "../../utils/clockManager";
import { gateColors, gateConfig, customColor } from "../../configs/gates";
import { getNodeSize } from "../../utils/nodeSize";
import { customComponentRegistry } from "../../configs/customComponents";

const GRID = 20;
const REGION_PAD = 22;
const PIN_R = 7;

function ToolBtn({ active, onClick, title, children }) {
    return (
        <button title={title} onClick={onClick} style={{
            width:38,height:38,display:"flex",alignItems:"center",justifyContent:"center",
            background:active?"var(--primary-light)":"var(--primary-bg)",
            border:active?"3px solid #000":"3px solid #000",
            borderRadius:0,color:active?"#000":"var(--primary-fg)",
            cursor:"pointer",fontSize:18,transition:"all 0.12s",flexShrink:0,fontWeight:900,
            boxShadow:active?"4px 4px 0 rgba(0,0,0,0.3)":"2px 2px 0 rgba(0,0,0,0.2)",
        }}
            onMouseEnter={e=>{if(!active){e.currentTarget.style.background="var(--secondary-bg)"; e.currentTarget.style.boxShadow="3px 3px 0 rgba(0,0,0,0.3)";}}}
            onMouseLeave={e=>{if(!active){e.currentTarget.style.background="var(--primary-bg)"; e.currentTarget.style.boxShadow="2px 2px 0 rgba(0,0,0,0.2)";}}}
        >{children}</button>
    );
}

function GhostNode({ type, x, y, width, height }) {
    const isIO = ["SWITCH","LED","CLOCK"].includes(type);
    const COLORS = {SWITCH:"#4a9eff",LED:"#ff6b35",CLOCK:"#87ceeb",AND:"#4a9eff",OR:"#ff6b9d",NOT:"var(--primary-light)"};
    const cc = customComponentRegistry[type];
    const bg = COLORS[type]||gateColors[type]||(cc?"#4a9eff":"#4a9eff");
    return (
        <div style={{position:"absolute",left:x,top:y,width,height,borderRadius:isIO?"0":"0",background:bg,border:"3px dashed #000",opacity:0.65,display:"flex",alignItems:"center",justifyContent:"center",boxSizing:"border-box",pointerEvents:"none",userSelect:"none"}}>
            {!isIO&&<span style={{fontSize:type.length>6?9:12,fontWeight:900,color:"#000",textTransform:"uppercase",padding:"0 4px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:width-8}}>{type}</span>}
        </div>
    );
}

function RegionPrompt({ x, y, onConfirm, onClose }) {
    const [val, setVal] = useState("");
    const inputRef = useRef(null);
    useEffect(()=>{setTimeout(()=>inputRef.current?.focus(),30);},[]);
    const top = Math.min(y, window.innerHeight-130);
    return (
        <div style={{position:"fixed",left:x,top,zIndex:3000,background:"var(--primary-bg)",border:"3px solid #000",borderRadius:0,padding:"14px 16px",width:230,boxShadow:"6px 6px 0 rgba(0,0,0,0.4)",display:"flex",flexDirection:"column",gap:10,userSelect:"none"}}
            onClick={e=>e.stopPropagation()} onMouseDown={e=>e.stopPropagation()}>
            <div style={{fontSize:12,fontWeight:900,color:"var(--primary-light)",letterSpacing:"0.1em",textTransform:"uppercase"}}>NAME REGION</div>
            <input ref={inputRef} value={val} onChange={e=>setVal(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter")onConfirm(val);if(e.key==="Escape")onClose();}}
                placeholder="e.g. ALU, Decoder…"
                style={{padding:"8px 10px",borderRadius:0,fontSize:12,border:"3px solid #000",background:"var(--primary-fg)",color:"#000",outline:"none",width:"100%",boxSizing:"border-box",fontWeight:700}}
                onFocus={e=>e.currentTarget.style.boxShadow="inset 0 0 0 2px var(--primary-dark)"}
                onBlur={e=>e.currentTarget.style.boxShadow="none"}
            />
            <div style={{display:"flex",gap:8}}>
                <button onClick={onClose} style={{flex:1,padding:"8px 0",borderRadius:0,border:"3px solid #000",background:"var(--secondary-bg)",color:"var(--primary-fg)",cursor:"pointer",fontSize:12,fontWeight:900,textTransform:"uppercase",boxShadow:"2px 2px 0 rgba(0,0,0,0.2)",transition:"all 0.1s"}} onMouseEnter={e=>{e.target.style.boxShadow="4px 4px 0 rgba(0,0,0,0.3)"; e.target.style.transform="translate(-2px, -2px)"}} onMouseLeave={e=>{e.target.style.boxShadow="2px 2px 0 rgba(0,0,0,0.2)"; e.target.style.transform="none"}}>Cancel</button>
                <button onClick={()=>onConfirm(val)} style={{flex:1,padding:"8px 0",borderRadius:0,border:"3px solid #000",background:"var(--primary-light)",color:"#000",fontWeight:900,cursor:"pointer",fontSize:12,textTransform:"uppercase",boxShadow:"2px 2px 0 rgba(0,0,0,0.2)",transition:"all 0.1s"}} onMouseEnter={e=>{e.target.style.boxShadow="4px 4px 0 rgba(0,0,0,0.3)"; e.target.style.transform="translate(-2px, -2px)"}} onMouseLeave={e=>{e.target.style.boxShadow="2px 2px 0 rgba(0,0,0,0.2)"; e.target.style.transform="none"}}>Add</button>
            </div>
        </div>
    );
}

function pinPos(node, pinInfo, isOutput) {
    if (node.type==="JUNCTION") return {x:node.x+5,y:node.y+5};
    return getPinPosition(node,pinInfo,isOutput);
}
function ghostSize(type) {
    const cc=customComponentRegistry[type];
    const cfg=gateConfig[type]||{inputs:cc?.inputPinMap?.length??2,outputs:cc?.outputPinMap?.length??1};
    const {width,height}=getNodeSize(type,cfg.inputs,cfg.outputs);
    return {w:width,h:height};
}
function distToSegment(px,py,ax,ay,bx,by){
    const dx=bx-ax,dy=by-ay,len2=dx*dx+dy*dy;
    if(len2===0)return Math.hypot(px-ax,py-ay);
    const t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/len2));
    return Math.hypot(px-ax-t*dx,py-ay-t*dy);
}
function findWireAtWorldPoint(px,py,nodes,wires,wireStyle,zoom){
    const THRESH=8/zoom;
    for(const wire of wires){
        const n1=nodes.find(n=>n.id===wire.from.nodeId),n2=nodes.find(n=>n.id===wire.to.nodeId);
        if(!n1||!n2)continue;
        const p1=pinPos(n1,wire.from,true),p2=pinPos(n2,wire.to,false);
        const wps=wire.waypoints||[];
        if(wps.length>0||wireStyle==="straight"){
            const pts=[p1,...wps,p2];
            for(let i=0;i<pts.length-1;i++)if(distToSegment(px,py,pts[i].x,pts[i].y,pts[i+1].x,pts[i+1].y)<THRESH)return wire;
        }else{
            const dx=p2.x-p1.x,s=Math.max(Math.abs(dx)*0.6,60);
            const cx1=p1.x+s,cy1=p1.y,cx2=p2.x-s,cy2=p2.y;
            let prev=p1;
            for(let i=1;i<=18;i++){
                const t=i/18,mt=1-t;
                const cur={x:mt*mt*mt*p1.x+3*mt*mt*t*cx1+3*mt*t*t*cx2+t*t*t*p2.x,y:mt*mt*mt*p1.y+3*mt*mt*t*cy1+3*mt*t*t*cy2+t*t*t*p2.y};
                if(distToSegment(px,py,prev.x,prev.y,cur.x,cur.y)<THRESH)return wire;
                prev=cur;
            }
        }
    }
    return null;
}
let _wid=9000; const wid=()=>++_wid;


function Workspace({
    nodes, setNodes, wires, setWires,
    regions, setRegions,
    pendingTypes, onPlacePending, onCancelPending,
    clipboardRef,
}) {
    const workspaceRef   = useRef(null);
    const cameraLayerRef = useRef(null);
    const gridRef        = useRef(null);
    const cameraRef      = useRef({x:0,y:0,zoom:1});
    const isPanningRef   = useRef(false);
    const panStartRef    = useRef({x:0,y:0});
    const activeWireRef  = useRef(null);
    const wiresRef       = useRef(wires);
    const nodesRef       = useRef(nodes);
    const regionsRef     = useRef(regions);
    const selectedRef    = useRef([]);
    const settingsRef    = useRef(null);
    const toolRef        = useRef("select");

    useEffect(()=>{wiresRef.current=wires;},[wires]);
    useEffect(()=>{nodesRef.current=nodes;},[nodes]);
    useEffect(()=>{regionsRef.current=regions;},[regions]);

    const { saveSnapshot, handleUndo, handleRedo, canUndo, canRedo, pauseTracking, resumeTracking } = useHistoryState(nodes, setNodes, wires, setWires, regions, setRegions);

    const [camera,setCamera]                       = useState({x:0,y:0,zoom:1});
    const [viewportSize,setViewportSize]           = useState({w:window.innerWidth,h:window.innerHeight});
    const [tool,setTool]                           = useState("select");
    const [activeWire,setActiveWire]               = useState(null);
    const [activeWireWaypoints,setActiveWireWaypoints] = useState([]);
    const [mousePos,setMousePos]                   = useState({x:0,y:0});
    const [selectedNodes,setSelectedNodes]         = useState([]);
    const [selectionBox,setSelectionBox]           = useState(null);
    const [nodeMenu,setNodeMenu]                   = useState(null);
    const [regionMenu,setRegionMenu]               = useState(null);
    const [truthTableType,setTruthTableType]       = useState(null);
    const [clockConfig,setClockConfig]             = useState(null);
    const [ghostWorldPos,setGhostWorldPos]         = useState(null);
    const [regionPrompt,setRegionPrompt]           = useState(null);
    const [ledDecimalRegion,setLedDecimalRegion]   = useState(null);
    const [ledDecimalPanelOpen,setLedDecimalPanelOpen] = useState(false);
    const [ledHoveredNodeId,setLedHoveredNodeId]  = useState(null);
    const labelInputRef = useRef(null);
    const {settings} = useSettings();

    useEffect(() => {
        const handleResize = () => setViewportSize({w: window.innerWidth, h: window.innerHeight});
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(()=>{activeWireRef.current=activeWire;},[activeWire]);
    useEffect(()=>{selectedRef.current=selectedNodes;});
    useEffect(()=>{settingsRef.current=settings;},[settings]);
    useEffect(()=>{toolRef.current=tool;},[tool]);

    const nodeMap = useMemo(()=>{
        const m=new Map();nodes.forEach(n=>m.set(n.id,n));return m;
    },[nodes]);

    const selectedSet = useMemo(()=>new Set(selectedNodes),[selectedNodes]);

    
    const compoundHiddenIds = useMemo(()=>{
        const ids=new Set();
        (regions||[]).filter(r=>r.isCompound).forEach(r=>{
            (r.inputNodeIds||[]).forEach(id=>ids.add(id));
            (r.outputNodeIds||[]).forEach(id=>ids.add(id));
        });
        return ids;
    },[regions]);

    const nodeColors = useMemo(()=>{
        const m=new Map();
        nodes.forEach(n=>{
            let c;const v=n.value===1;
            if(n.type==="SWITCH")   c=v?settings.switchOnColor:settings.switchOffColor;
            else if(n.type==="LED") c=v?settings.ledOnColor:settings.ledOffColor;
            else if(n.type==="CLOCK")    c=v?"rgba(137,180,250,0.28)":"#1a2a3a";
            else if(n.type==="JUNCTION") c=v?settings.wireActiveColor:settings.wireInactiveColor;
            else if(n.type==="AND") c=settings.gateAndColor;
            else if(n.type==="OR")  c=settings.gateOrColor;
            else if(n.type==="NOT") c=settings.gateNotColor;
            else c=gateColors[n.type]||customColor(n.type);
            m.set(n.id,c);
        });
        return m;
    },[nodes,settings]);

    const visibleNodes = useMemo(()=>
        nodes.filter(n => !compoundHiddenIds.has(n.id) && 
            ((n.x * camera.zoom) + camera.x + 80 * camera.zoom > 0 &&
             (n.x * camera.zoom) + camera.x < viewportSize.w &&
             (n.y * camera.zoom) + camera.y + 40 * camera.zoom > 0 &&
             (n.y * camera.zoom) + camera.y < viewportSize.h))
    ,[nodes, compoundHiddenIds, camera, viewportSize]);

    const visibleWires = useMemo(()=>{
        const filtered = wires.filter(w => !compoundHiddenIds.has(w.from.nodeId) && !compoundHiddenIds.has(w.to.nodeId));
        return filtered.filter(w => {
            const n1 = nodeMap.get(w.from.nodeId), n2 = nodeMap.get(w.to.nodeId);
            if (!n1 || !n2) return false;
            const p1x = (n1.x * camera.zoom) + camera.x, p1y = (n1.y * camera.zoom) + camera.y;
            const p2x = (n2.x * camera.zoom) + camera.x, p2y = (n2.y * camera.zoom) + camera.y;
            const minX = Math.min(p1x, p2x) - 50, maxX = Math.max(p1x, p2x) + 50;
            const minY = Math.min(p1y, p2y) - 50, maxY = Math.max(p1y, p2y) + 50;
            return !(maxX < 0 || minX > viewportSize.w || maxY < 0 || minY > viewportSize.h);
        });
    },[wires, compoundHiddenIds, nodeMap, camera, viewportSize]);

    const ledDecimalRegionObj = useMemo(() => 
        (regions || []).find(r => r.id === ledDecimalRegion) || null,
        [regions, ledDecimalRegion]
    );

    const ledDecimalConverterHookData = useLEDDecimalConverter(nodes, ledDecimalRegionObj);

    
    const prevSigRef = useRef(0);
    useEffect(()=>{
        // Fast hash-based dirty checking instead of string building
        let hash = 0;
        for(let i=0;i<nodes.length;i++){
            const n=nodes[i];
            hash^=(n.id*33)^(n.value<<2)^((n.outputs?.length||0)<<4);
        }
        for(let i=0;i<wires.length;i++){
            hash^=(wires[i].from.nodeId<<1)^(wires[i].to.nodeId<<3);
        }
        if(hash===prevSigRef.current)return;
        
        const newNodes=propagate(nodes,wires);
        let valOutChanged=false, stateOnlyChanged=false;
        const merged=nodes.map(orig=>{
            const n=newNodes.find(x=>x.id===orig.id);
            if(!n)return orig;
            const vEq=n.value===orig.value;
            const oEq=n.outputs===orig.outputs||((!n.outputs&&!orig.outputs)||(n.outputs&&orig.outputs&&n.outputs.length===orig.outputs.length&&n.outputs.every((v,i)=>v===orig.outputs[i])));
            const iEq=n.internalState===orig.internalState;
            if(vEq&&oEq&&iEq)return orig;
            if(!vEq||!oEq)valOutChanged=true; else stateOnlyChanged=true;
            return n;
        });
        if(valOutChanged){prevSigRef.current=0;setNodes(merged);}
        else if(stateOnlyChanged){setNodes(merged);}
        else prevSigRef.current=hash;
    },[nodes,wires]);

    
    useEffect(()=>{
        setClockChangeHandler((nodeId,newValue)=>{
            setNodes(prev=>{
                const idx=prev.findIndex(n=>n.id===nodeId);
                if(idx===-1||prev[idx].value===newValue)return prev;
                const next=[...prev];next[idx]={...next[idx],value:newValue};return next;
            });
        });
        return ()=>stopAllClocks();
    },[]);
    useEffect(()=>{syncClocks(nodes);},[nodes]);

    useEffect(()=>{
        if(ledDecimalRegion && (!ledDecimalRegionObj || !ledDecimalRegionObj.nodeIds || ledDecimalRegionObj.nodeIds.length === 0)){
            setLedDecimalRegion(null);
            setLedDecimalPanelOpen(false);
        }
    },[ledDecimalRegion, ledDecimalRegionObj]);

    const applyCameraDOM = (cam) => {
        cameraRef.current = cam;
        if (cameraLayerRef.current)
            cameraLayerRef.current.style.transform =
                `translate(${cam.x}px,${cam.y}px) scale(${cam.zoom})`;
        if (gridRef.current) {
            const s = settingsRef.current;
            if (s?.showGrid) {
                const cellPx = GRID * cam.zoom;
                const ox = ((cam.x % cellPx) + cellPx) % cellPx;
                const oy = ((cam.y % cellPx) + cellPx) % cellPx;
                gridRef.current.style.backgroundSize     = `${cellPx}px ${cellPx}px`;
                gridRef.current.style.backgroundPosition = `${ox}px ${oy}px`;
                gridRef.current.style.backgroundImage    =
                    `linear-gradient(${s.gridColor} 1px, transparent 1px),` +
                    `linear-gradient(90deg, ${s.gridColor} 1px, transparent 1px)`;
            } else {
                gridRef.current.style.backgroundImage = "none";
            }
        }
    };

    const screenToWorld = useCallback((sx,sy)=>{
        const c=cameraRef.current;
        return {x:(sx-c.x)/c.zoom,y:(sy-c.y)/c.zoom};
    },[]);

    const focusOrigin = useCallback(()=>{
        const rect=workspaceRef.current.getBoundingClientRect();
        const cam={x:rect.width/2,y:rect.height/2,zoom:1};
        applyCameraDOM(cam);setCamera(cam);
    },[]);

    const fitAll = useCallback(()=>{
        const ns=nodesRef.current;
        if(!ns.length){focusOrigin();return;}
        const xs=ns.map(n=>n.x),ys=ns.map(n=>n.y);
        const minX=Math.min(...xs)-60,maxX=Math.max(...xs)+120;
        const minY=Math.min(...ys)-60,maxY=Math.max(...ys)+120;
        const rect=workspaceRef.current.getBoundingClientRect();
        const zoom=Math.min(rect.width/(maxX-minX),rect.height/(maxY-minY),1.5);
        const cam={x:rect.width/2-((minX+maxX)/2)*zoom,y:rect.height/2-((minY+maxY)/2)*zoom,zoom};
        applyCameraDOM(cam);setCamera(cam);
    },[focusOrigin]);

    useEffect(()=>{applyCameraDOM(cameraRef.current);},[settings.showGrid,settings.gridColor,settings.bgColor]);

    
    const cancelWire = useCallback(()=>{setActiveWire(null);setActiveWireWaypoints([]);},[]);

    const updateNodePosition = useCallback((id,x,y,action=null,isGroupDrag=false)=>{
        const snap=settingsRef.current?.snapToGrid?GRID:1;
        const sx=Math.round(x/snap)*snap,sy=Math.round(y/snap)*snap;
        setNodes(prev=>{
            const target=prev.find(n=>n.id===id);
            if(!target)return prev;
            if(action==="toggle")return prev.map(n=>n.id===id?{...n,value:n.value?0:1}:n);
            const dx=sx-target.x,dy=sy-target.y;
            if(dx===0&&dy===0)return prev;
            const sel=selectedRef.current;
            return prev.map(n=>{
                if(isGroupDrag&&sel.includes(n.id))return{...n,x:Math.round((n.x+dx)/GRID)*GRID,y:Math.round((n.y+dy)/GRID)*GRID};
                if(n.id===id)return{...n,x:sx,y:sy};
                return n;
            });
        });
    },[]);

    const handlePinClick = useCallback((pin)=>{
        if(toolRef.current==="erase")return;
        const aw=activeWireRef.current;
        if(!aw){if(pin.type==="output")setActiveWire(pin);return;}
        if(aw.type==="output"&&pin.type==="input"){
            const already=wiresRef.current.some(w=>w.to.nodeId===pin.nodeId&&w.to.index===pin.index);
            if(!already){
                setWires(prev=>[...prev,{
                    id:wid(),
                    from:{nodeId:aw.nodeId,index:aw.index,total:aw.total},
                    to:{nodeId:pin.nodeId,index:pin.index,total:pin.total},
                    waypoints:activeWireWaypoints.length>0?[...activeWireWaypoints]:undefined,
                }]);
            }
        }
        setActiveWire(null);setActiveWireWaypoints([]);
    },[activeWireWaypoints]);

    const eraseNode = useCallback((id)=>{
        setNodes(prev=>prev.filter(n=>n.id!==id));
        setWires(prev=>prev.filter(w=>w.from.nodeId!==id&&w.to.nodeId!==id));
        setSelectedNodes(prev=>prev.filter(nid=>nid!==id));
        if(ledDecimalRegion){
            setRegions(prev=>{
                const r=prev.find(rr=>rr.id===ledDecimalRegion);
                if(r&&r.nodeIds.includes(id)){
                    const remainingNodeIds=r.nodeIds.filter(nid=>nid!==id);
                    if(remainingNodeIds.length===0){
                        setLedDecimalRegion(null);
                        setLedDecimalPanelOpen(false);
                        return prev.filter(rr=>rr.id!==r.id);
                    }else{
                        return prev.map(rr=>rr.id===ledDecimalRegion?{...rr,nodeIds:remainingNodeIds}:rr);
                    }
                }
                return prev;
            });
        }
    },[]);

    const onSelectNode = useCallback((id)=>{setSelectionBox(null);setSelectedNodes([id]);},[]);

    const openNodeMenu = useCallback((e,id)=>{
        if(toolRef.current==="erase")return;
        const node=nodesRef.current.find(n=>n.id===id);
        setNodeMenu({nodeId:id,x:e.clientX,y:e.clientY,mode:"menu",labelValue:node?.label||""});
    },[]);

    const handleDeleteSelected = useCallback(()=>{
        const sel=selectedRef.current;
        if(!sel.length)return;
        const selSet=new Set(sel);
        setNodes(prev=>prev.filter(n=>!selSet.has(n.id)));
        setWires(prev=>prev.filter(w=>!selSet.has(w.from.nodeId)&&!selSet.has(w.to.nodeId)));
        setSelectedNodes([]);
        if(ledDecimalRegion){
            setRegions(prev=>{
                const r=prev.find(rr=>rr.id===ledDecimalRegion);
                if(r){
                    const remainingNodeIds=r.nodeIds.filter(nid=>!selSet.has(nid));
                    if(remainingNodeIds.length===0){
                        setLedDecimalRegion(null);
                        setLedDecimalPanelOpen(false);
                        return prev.filter(rr=>rr.id!==r.id);
                    }else if(remainingNodeIds.length<r.nodeIds.length){
                        return prev.map(rr=>rr.id===ledDecimalRegion?{...rr,nodeIds:remainingNodeIds}:rr);
                    }
                }
                return prev;
            });
        }
    },[]);

    const handleBitToggle = useCallback((nodeId,bitIndex)=>{
        setNodes(prev=>prev.map(n=>{
            if(n.id!==nodeId)return n;
            const bitCount=parseInt(n.type.split("_")[1])||1;
            const newOutputs=[...(n.outputs||Array(bitCount).fill(0))];
            newOutputs[bitIndex]=newOutputs[bitIndex]?0:1;
            return{...n,outputs:newOutputs};
        }));
    },[]);

    
    const handleJoin = useCallback(()=>{
        const sel = selectedRef.current;
        if (sel.length < 2) return;
        const allNodes = nodesRef.current;
        const selNodes = allNodes.filter(n => sel.includes(n.id));
        const switches  = selNodes.filter(n => n.type === 'SWITCH').sort((a,b)=>a.y-b.y);
        const leds      = selNodes.filter(n => n.type === 'LED').sort((a,b)=>a.y-b.y);
        const circuits  = selNodes.filter(n =>
            n.type !== 'SWITCH' && n.type !== 'LED' &&
            n.type !== 'JUNCTION' && n.type !== 'CLOCK'
        );
        if (circuits.length !== 1) return;
        const circuit = circuits[0];
        const cc  = customComponentRegistry[circuit.type];
        const cfg = gateConfig[circuit.type] || {
            inputs:  cc?.inputPinMap?.length  ?? 2,
            outputs: cc?.outputPinMap?.length ?? 1,
        };
        const currentWires = wiresRef.current;
        const newWires = [];
        switches.forEach((sw, i) => {
            if (i >= cfg.inputs) return;
            const dup = currentWires.some(w => w.from.nodeId===sw.id && w.to.nodeId===circuit.id && w.to.index===i);
            if (!dup) newWires.push({ id:wid(), from:{nodeId:sw.id,index:0,total:1}, to:{nodeId:circuit.id,index:i,total:cfg.inputs} });
        });
        leds.forEach((led, i) => {
            if (i >= cfg.outputs) return;
            const dup = currentWires.some(w => w.from.nodeId===circuit.id && w.from.index===i && w.to.nodeId===led.id);
            if (!dup) newWires.push({ id:wid(), from:{nodeId:circuit.id,index:i,total:cfg.outputs}, to:{nodeId:led.id,index:0,total:1} });
        });
        if (newWires.length) setWires(prev => [...prev, ...newWires]);
    }, []);

    
    
    
    const handleMakeCompound = useCallback((regionId)=>{
        const region = regionsRef.current?.find(r=>r.id===regionId);
        if(!region) return;
        const regionNodes = nodesRef.current.filter(n=>region.nodeIds.includes(n.id));
        const switches = regionNodes.filter(n=>n.type==='SWITCH').sort((a,b)=>a.y-b.y);
        const leds     = regionNodes.filter(n=>n.type==='LED').sort((a,b)=>a.y-b.y);
        const currentWires = wiresRef.current;

        
        const inputWireTargets = switches.map(sw=>({
            switchId: sw.id,
            label:    sw.label || null,
            targets:  currentWires
                .filter(w=>w.from.nodeId===sw.id)
                .map(w=>({nodeId:w.to.nodeId, index:w.to.index, total:w.to.total})),
        }));

        
        const outputWireSources = leds.map(led=>({
            ledId:  led.id,
            label:  led.label || null,
            source: currentWires.find(w=>w.to.nodeId===led.id&&w.to.index===0)
                ? {
                    nodeId: currentWires.find(w=>w.to.nodeId===led.id&&w.to.index===0).from.nodeId,
                    index:  currentWires.find(w=>w.to.nodeId===led.id&&w.to.index===0).from.index,
                    total:  currentWires.find(w=>w.to.nodeId===led.id&&w.to.index===0).from.total,
                  }
                : null,
        }));

        
        const switchIdSet = new Set(switches.map(s=>s.id));
        setWires(prev=>prev.filter(w=>!switchIdSet.has(w.from.nodeId)));

        if(setRegions) setRegions(prev=>prev.map(r=>
            r.id===regionId
            ? {
                ...r,
                isCompound:        true,
                inputNodeIds:      switches.map(s=>s.id),
                outputNodeIds:     leds.map(l=>l.id),
                inputWireTargets,  
                outputWireSources, 
              }
            : r
        ));
        setRegionMenu(null);
    },[]);

    
    const handleRemoveCompound = useCallback((regionId)=>{
        const region = regionsRef.current?.find(r=>r.id===regionId);
        if(!region) return;
        
        const restoredWires = (region.inputWireTargets||[]).flatMap(entry=>
            entry.targets.map(t=>({
                id:wid(),
                from:{nodeId:entry.switchId, index:0, total:1},
                to:t,
            }))
        );
        if(restoredWires.length) setWires(prev=>[...prev,...restoredWires]);
        if(setRegions) setRegions(prev=>prev.map(r=>
            r.id===regionId
            ? {...r, isCompound:false, inputNodeIds:undefined, outputNodeIds:undefined, inputWireTargets:undefined, outputWireSources:undefined}
            : r
        ));
        setRegionMenu(null);
    },[]);

    
    
    
    
    
    
    
    
    
    
    const handleCompoundPinClick = useCallback((e, regionId, pinIndex, isInput)=>{
        e.stopPropagation();
        if(toolRef.current==="erase") return;

        const region = regionsRef.current?.find(r=>r.id===regionId);
        if(!region) return;

        const aw = activeWireRef.current;
        const waypoints = [...(activeWireRef.current ? [] : [])]; 

        if(isInput){
            
            if(!aw || aw.type!=="output") return;

            const entry = (region.inputWireTargets||[])[pinIndex];
            if(!entry) return;

            const cur = wiresRef.current;
            const newWires = (entry.targets||[])
                .filter(t=>!cur.some(w=>
                    w.from.nodeId===aw.nodeId && w.from.index===aw.index &&
                    w.to.nodeId===t.nodeId   && w.to.index===t.index
                ))
                .map(t=>({
                    id:wid(),
                    from:{nodeId:aw.nodeId, index:aw.index, total:aw.total},
                    to:t,
                }));
            if(newWires.length) setWires(prev=>[...prev,...newWires]);
            setActiveWire(null);
            setActiveWireWaypoints([]);

        } else {
            
            if(aw) return;

            const entry = (region.outputWireSources||[])[pinIndex];
            if(!entry?.source) return;

            setActiveWire({
                type:   "output",
                nodeId: entry.source.nodeId,
                index:  entry.source.index,
                total:  entry.source.total,
            });
            setActiveWireWaypoints([]);
        }
    },[]);

    
    const handleCopy = useCallback(()=>{
        const sel=selectedRef.current;
        if(!sel.length)return;
        const idSet=new Set(sel);
        const copiedRegions=(regions||[]).filter(r=>r.nodeIds?.length>0&&r.nodeIds.every(id=>idSet.has(id)));
        clipboardRef.current={
            nodes:JSON.parse(JSON.stringify(nodesRef.current.filter(n=>idSet.has(n.id)))),
            wires:JSON.parse(JSON.stringify(wiresRef.current.filter(w=>idSet.has(w.from.nodeId)&&idSet.has(w.to.nodeId)))),
            regions:copiedRegions,
        };
    },[regions,clipboardRef]);

    const handlePaste = useCallback(()=>{
        if(!clipboardRef.current?.nodes?.length)return;
        const OFFSET=40;
        const idMap=new Map();
        const newNodes=clipboardRef.current.nodes.map(n=>{
            const newId=wid();idMap.set(n.id,newId);
            return{...n,id:newId,x:n.x+OFFSET,y:n.y+OFFSET};
        });
        const newWires=clipboardRef.current.wires.map(w=>({
            ...w,id:wid(),
            from:{...w.from,nodeId:idMap.get(w.from.nodeId)??w.from.nodeId},
            to:{...w.to,nodeId:idMap.get(w.to.nodeId)??w.to.nodeId},
        }));
        const newRegions=(clipboardRef.current.regions||[]).map(r=>({
            ...r,id:wid(),
            nodeIds:r.nodeIds.map(id=>idMap.get(id)??id),
            inputNodeIds:r.inputNodeIds?.map(id=>idMap.get(id)??id),
            outputNodeIds:r.outputNodeIds?.map(id=>idMap.get(id)??id),
            inputWireTargets:r.inputWireTargets?.map(entry=>({
                ...entry,
                switchId:idMap.get(entry.switchId)??entry.switchId,
                targets:entry.targets.map(t=>({...t,nodeId:idMap.get(t.nodeId)??t.nodeId})),
            })),
            outputWireSources:r.outputWireSources?.map(entry=>({
                ...entry,
                ledId:idMap.get(entry.ledId)??entry.ledId,
                source:entry.source?{...entry.source,nodeId:idMap.get(entry.source.nodeId)??entry.source.nodeId}:null,
            })),
        }));
        setNodes(prev=>[...prev,...newNodes]);
        setWires(prev=>[...prev,...newWires]);
        if(newRegions.length&&setRegions)setRegions(prev=>[...prev,...newRegions]);
        setSelectedNodes(newNodes.map(n=>n.id));
    },[clipboardRef,regions]);

    
    const confirmRegion=(label)=>{
        if(!regionPrompt||!label?.trim()){setRegionPrompt(null);return;}
        if(setRegions)setRegions(prev=>[...prev,{id:wid(),label:label.trim(),nodeIds:regionPrompt.nodeIds}]);
        setRegionPrompt(null);
    };
    const computeRegionBounds=(nodeIds)=>{
        const sel=nodesRef.current.filter(n=>nodeIds.includes(n.id));
        if(!sel.length)return null;
        const xs=sel.map(n=>n.x),ys=sel.map(n=>n.y);
        const xe=sel.map(n=>{const cfg=gateConfig[n.type];const{width}=getNodeSize(n.type,cfg?.inputs??2,cfg?.outputs??1);return n.x+width;});
        const ye=sel.map(n=>{const cfg=gateConfig[n.type];const{height}=getNodeSize(n.type,cfg?.inputs??2,cfg?.outputs??1);return n.y+height;});
        return{x:Math.min(...xs)-REGION_PAD,y:Math.min(...ys)-REGION_PAD,w:Math.max(...xe)-Math.min(...xs)+REGION_PAD*2,h:Math.max(...ye)-Math.min(...ys)+REGION_PAD*2};
    };

    
    const handleDeleteNode=()=>{
        const id=nodeMenu.nodeId;
        setNodes(prev=>prev.filter(n=>n.id!==id));
        setWires(prev=>prev.filter(w=>w.from.nodeId!==id&&w.to.nodeId!==id));
        setSelectedNodes(prev=>prev.filter(nid=>nid!==id));
        if(ledDecimalRegion){
            setRegions(prev=>{
                const r=prev.find(rr=>rr.id===ledDecimalRegion);
                if(r&&r.nodeIds.includes(id)){
                    if(r.nodeIds.length===1){
                        setLedDecimalRegion(null);
                        setLedDecimalPanelOpen(false);
                        return prev.filter(rr=>rr.id!==r.id);
                    }else{
                        return prev.map(rr=>rr.id===ledDecimalRegion?{...rr,nodeIds:rr.nodeIds.filter(nid=>nid!==id)}:rr);
                    }
                }
                return prev;
            });
        }
        setNodeMenu(null);
    };
    const handleDuplicateNode=()=>{
        const node=nodes.find(n=>n.id===nodeMenu.nodeId);
        if(!node){setNodeMenu(null);return;}
        setNodes(prev=>[...prev,{...node,id:wid(),x:node.x+40,y:node.y+40}]);
        setNodeMenu(null);
    };
    const handleSetLabel=()=>{setNodeMenu(p=>({...p,mode:"label"}));setTimeout(()=>labelInputRef.current?.focus(),50);};
    const confirmLabel=()=>{
        const{nodeId,labelValue}=nodeMenu;
        setNodes(prev=>prev.map(n=>n.id===nodeId?{...n,label:labelValue.trim()||undefined}:n));
        setNodeMenu(null);
    };
    const handleClockSave=({hz,duty})=>{
        setNodes(prev=>prev.map(n=>n.id===clockConfig.node.id?{...n,hz,duty}:n));
        setClockConfig(null);
    };

    
    useEffect(()=>{
        const onKey=(e)=>{
            if(document.activeElement.tagName==="INPUT")return;
            const mod=e.ctrlKey||e.metaKey;
            if(e.key==="Delete"||e.key==="Backspace")handleDeleteSelected();
            if(e.key==="Escape"){cancelWire();setNodeMenu(null);setRegionMenu(null);setClockConfig(null);setTool("select");onCancelPending?.();setGhostWorldPos(null);setRegionPrompt(null);}
            if(!mod&&(e.key==="f"||e.key==="F"))fitAll();
            if(!mod&&(e.key==="h"||e.key==="H"))focusOrigin();
            if(mod&&e.key==="c"){e.preventDefault();handleCopy();}
            if(mod&&e.key==="v"){e.preventDefault();handlePaste();}
            if(mod&&e.key==="d"){e.preventDefault();handleCopy();setTimeout(()=>handlePaste(),0);}
            if(mod&&e.key==="a"){e.preventDefault();setSelectedNodes(nodesRef.current.filter(n=>n.type!=="JUNCTION").map(n=>n.id));}
            if(mod&&e.key==="g"){e.preventDefault();if(selectedRef.current.length>=2)setRegionPrompt({nodeIds:[...selectedRef.current],x:window.innerWidth/2,y:window.innerHeight/2});}
            if(!mod&&(e.key==="j"||e.key==="J"))handleJoin();
        };
        window.addEventListener("keydown",onKey);
        return()=>window.removeEventListener("keydown",onKey);
    },[handleDeleteSelected,cancelWire,fitAll,focusOrigin,handleCopy,handlePaste,handleJoin]);

    const cursorMap={select:"default",pan:"grab",erase:"crosshair"};

    const handleMouseDown=(e)=>{
        const rect=workspaceRef.current.getBoundingClientRect();
        const sx=e.clientX-rect.left,sy=e.clientY-rect.top;
        if(e.button===1||tool==="pan"){
            isPanningRef.current=true;
            panStartRef.current={x:sx-cameraRef.current.x,y:sy-cameraRef.current.y};
            workspaceRef.current.style.cursor="grabbing";
            return;
        }
        if(e.button===0&&tool==="select"&&!activeWireRef.current){
            const cam=cameraRef.current;
            const wx=(sx-cam.x)/cam.zoom,wy=(sy-cam.y)/cam.zoom;
            const hitWire=findWireAtWorldPoint(wx,wy,nodesRef.current,wiresRef.current,settings.wireStyle,cam.zoom);
            if(hitWire){
                e.stopPropagation();
                setNodeMenu(null);setRegionMenu(null);setSelectedNodes([]);
                const snap=settings.snapToGrid?GRID:1;
                const jId=wid();
                const centerX=Math.round(wx/snap)*snap,centerY=Math.round(wy/snap)*snap;
                const jNode={id:jId,type:"JUNCTION",x:centerX-5,y:centerY-5,value:0,label:""};
                setNodes(prev=>[...prev,jNode]);
                setWires(prev=>[
                    ...prev.filter(w=>w.id!==hitWire.id),
                    {id:wid(),from:hitWire.from,to:{nodeId:jId,index:0,total:1},waypoints:undefined},
                    {id:wid(),from:{nodeId:jId,index:0,total:1},to:hitWire.to,waypoints:hitWire.waypoints?[...hitWire.waypoints]:undefined},
                ]);
                setActiveWire({type:"output",nodeId:jId,index:0,total:1});
                setActiveWireWaypoints([]);
                return;
            }
        }
        if(e.button===0){
            cancelWire();setNodeMenu(null);setRegionMenu(null);setClockConfig(null);setSelectedNodes([]);
            if(tool==="select")setSelectionBox({startX:sx,startY:sy,endX:sx,endY:sy});
        }
    };

    const handleMouseMove=(e)=>{
        const rect=workspaceRef.current.getBoundingClientRect();
        const sx=e.clientX-rect.left,sy=e.clientY-rect.top;
        if(isPanningRef.current){
            const cam={x:sx-panStartRef.current.x,y:sy-panStartRef.current.y,zoom:cameraRef.current.zoom};
            applyCameraDOM(cam);
            return;
        }
        if(selectionBox)setSelectionBox(prev=>prev?{...prev,endX:sx,endY:sy}:null);
        if(activeWireRef.current)setMousePos(screenToWorld(sx,sy));
    };

    const handleMouseUp=()=>{
        if(isPanningRef.current){
            isPanningRef.current=false;
            workspaceRef.current.style.cursor=cursorMap[toolRef.current];
            setCamera({...cameraRef.current});
            return;
        }
        if(selectionBox){
            const box=selectionBox;
            const minX=Math.min(box.startX,box.endX),maxX=Math.max(box.startX,box.endX);
            const minY=Math.min(box.startY,box.endY),maxY=Math.max(box.startY,box.endY);
            if(maxX-minX>6&&maxY-minY>6){
                const wMin=screenToWorld(minX,minY),wMax=screenToWorld(maxX,maxY);
                setSelectedNodes(nodes.filter(n=>n.x>=wMin.x&&n.x<=wMax.x&&n.y>=wMin.y&&n.y<=wMax.y).map(n=>n.id));
            }
            setSelectionBox(null);
        }
    };

    const handleWheel=(e)=>{
        e.preventDefault();cancelWire();
        const rect=workspaceRef.current.getBoundingClientRect();
        const mx=e.clientX-rect.left,my=e.clientY-rect.top;
        const s=settingsRef.current?.zoomSensitivity??1;
        const zf=e.deltaY>0?(1-0.1*s):(1+0.1*s);
        const oldCam=cameraRef.current;
        const newZoom=Math.min(Math.max(oldCam.zoom*zf,0.2),4);
        const wm={x:(mx-oldCam.x)/oldCam.zoom,y:(my-oldCam.y)/oldCam.zoom};
        const cam={x:mx-wm.x*newZoom,y:my-wm.y*newZoom,zoom:newZoom};
        applyCameraDOM(cam);setCamera(cam);
    };

    
    const handleContextMenu=(e)=>{
        e.preventDefault();
        if(activeWireRef.current){
            const rect=workspaceRef.current.getBoundingClientRect();
            const wp=screenToWorld(e.clientX-rect.left,e.clientY-rect.top);
            setActiveWireWaypoints(prev=>[...prev,wp]);
        }
    };

    const handleGhostMouseMove=(e)=>{
        const rect=workspaceRef.current.getBoundingClientRect();
        setGhostWorldPos(screenToWorld(e.clientX-rect.left,e.clientY-rect.top));
    };
    const getGhostPositions=()=>{
        if(!ghostWorldPos||!pendingTypes?.length)return[];
        const sizes=pendingTypes.map(t=>ghostSize(t));
        const totalH=sizes.reduce((s,sz)=>s+sz.h,0)+(pendingTypes.length-1)*12;
        let curY=ghostWorldPos.y-totalH/2;
        return pendingTypes.map((type,i)=>{
            const sz=sizes[i];
            const pos={type,x:ghostWorldPos.x-sz.w/2,y:curY,w:sz.w,h:sz.h};
            curY+=sz.h+12;return pos;
        });
    };
    const handleGhostPlace=()=>{
        if(!ghostWorldPos||!pendingTypes?.length)return;
        const snap=settingsRef.current?.snapToGrid?GRID:1;
        const sizes=pendingTypes.map(t=>ghostSize(t));
        const totalH=sizes.reduce((s,sz)=>s+sz.h,0)+(pendingTypes.length-1)*12;
        let curY=ghostWorldPos.y-totalH/2;
        const placements=pendingTypes.map((type,i)=>{
            const sz=sizes[i];
            const px=Math.round((ghostWorldPos.x-sz.w/2)/snap)*snap;
            const py=Math.round(curY/snap)*snap;
            curY+=sz.h+12;return{type,x:px,y:py};
        });
        onPlacePending?.(placements);setGhostWorldPos(null);
    };

    const{wireActiveColor,wireInactiveColor,wireStyle}=settings;

    
    
    const compoundPinData = useMemo(()=>{
        return (regions||[])
            .filter(r=>r.isCompound)
            .map(region=>{
                const b = (() => {
                    const sel = nodes.filter(n=>region.nodeIds.includes(n.id));
                    if(!sel.length) return null;
                    const xs=sel.map(n=>n.x),ys=sel.map(n=>n.y);
                    const xe=sel.map(n=>{const cfg=gateConfig[n.type];const{width}=getNodeSize(n.type,cfg?.inputs??2,cfg?.outputs??1);return n.x+width;});
                    const ye=sel.map(n=>{const cfg=gateConfig[n.type];const{height}=getNodeSize(n.type,cfg?.inputs??2,cfg?.outputs??1);return n.y+height;});
                    return{x:Math.min(...xs)-REGION_PAD,y:Math.min(...ys)-REGION_PAD,w:Math.max(...xe)-Math.min(...xs)+REGION_PAD*2,h:Math.max(...ye)-Math.min(...ys)+REGION_PAD*2};
                })();
                if(!b) return null;

                const inEntries  = region.inputWireTargets  || [];
                const outEntries = region.outputWireSources || [];

                const inputs = inEntries.map((entry, i)=>{
                    
                    const isActive = entry.targets.some(t=>{
                        const dw = wires.find(w=>w.to.nodeId===t.nodeId&&w.to.index===t.index);
                        if(!dw) return false;
                        return nodeMap.get(dw.from.nodeId)?.value===1;
                    });
                    return {
                        regionId: region.id,
                        pinIndex: i,
                        label: entry.label || `I${i}`,
                        isActive,
                        wx: b.x,
                        wy: b.y + b.h*(i+1)/(inEntries.length+1),
                    };
                });

                const outputs = outEntries.map((entry, i)=>{
                    const ledNode  = nodeMap.get(entry.ledId);
                    const isActive = ledNode?.value===1;
                    const hasSource = !!entry.source;
                    return {
                        regionId: region.id,
                        pinIndex: i,
                        label: entry.label || `O${i}`,
                        isActive,
                        hasSource,
                        wx: b.x + b.w,
                        wy: b.y + b.h*(i+1)/(outEntries.length+1),
                    };
                });

                return { regionId: region.id, inputs, outputs };
            })
            .filter(Boolean);
    },[regions, nodes, wires, nodeMap]);

    return (
        <div style={{flex:1,display:"flex",flexDirection:"column",position:"relative",overflow:"hidden",height:"100%"}}>

            {settings.showToolbar&&(
                <div style={{position:"absolute",top:14,left:"50%",transform:"translateX(-50%)",display:"flex",alignItems:"center",gap:4,background:"#1a1a2a",border:"1px solid #2a2a3e",borderRadius:10,padding:"4px 6px",zIndex:100,boxShadow:"0 2px 12px rgba(0,0,0,0.4)",userSelect:"none"}}>
                    <ToolBtn active={tool==="select"} onClick={()=>setTool("select")} title="Select">↖</ToolBtn>
                    <ToolBtn active={tool==="pan"}    onClick={()=>setTool("pan")}    title="Pan">✥</ToolBtn>
                    <ToolBtn active={tool==="erase"}  onClick={()=>setTool("erase")}  title="Erase">✕</ToolBtn>
                    <div style={{width:1,height:22,background:"#2a2a3e",margin:"0 2px"}}/>
                    <ToolBtn active={false} onClick={fitAll} title="Fit all (F)">⛶</ToolBtn>
                    <div style={{width:1,height:22,background:"#2a2a3e",margin:"0 2px"}}/>
                    <ToolBtn active={false} onClick={handleUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" style={{opacity:canUndo?1:0.5,cursor:canUndo?"pointer":"not-allowed"}}>↶</ToolBtn>
                    <ToolBtn active={false} onClick={handleRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" style={{opacity:canRedo?1:0.5,cursor:canRedo?"pointer":"not-allowed"}}>↷</ToolBtn>
                </div>
            )}

            <button onClick={focusOrigin} title="Focus origin (H)" style={{position:"absolute",bottom:20,right:20,zIndex:100,width:44,height:44,borderRadius:0,background:"var(--primary-light)",border:"3px solid #000",color:"#000",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"4px 4px 0 rgba(0,0,0,0.3)",transition:"all 0.15s",fontSize:20,fontWeight:900}}
                onMouseEnter={e=>{e.currentTarget.style.background="var(--primary-dark)";e.currentTarget.style.boxShadow="6px 6px 0 rgba(0,0,0,0.4)"; e.currentTarget.style.transform="translate(-2px, -2px)"}}
                onMouseLeave={e=>{e.currentTarget.style.background="var(--primary-light)";e.currentTarget.style.boxShadow="4px 4px 0 rgba(0,0,0,0.3)"; e.currentTarget.style.transform="none"}}
            >⌖</button>

            {truthTableType&&<TruthTablePanel type={truthTableType} onClose={()=>setTruthTableType(null)}/>}
            {clockConfig&&<ClockConfig node={clockConfig.node} x={clockConfig.x} y={clockConfig.y} onSave={handleClockSave} onClose={()=>setClockConfig(null)}/>}
            {regionPrompt&&<RegionPrompt x={regionPrompt.x} y={regionPrompt.y} onConfirm={confirmRegion} onClose={()=>setRegionPrompt(null)}/>}
            {ledDecimalRegion&&ledDecimalPanelOpen&&(
                <LEDDecimalConverterPanelWrapper
                    hookData={ledDecimalConverterHookData}
                    onExit={()=>{setLedDecimalRegion(null);if(setRegions)setRegions(prev=>prev.filter(r=>r.id!==ledDecimalRegion));}}
                    onHoverLED={setLedHoveredNodeId}
                />
            )}

            {}
            <div className="workspace" ref={workspaceRef}
                style={{cursor:cursorMap[tool],background:settings.bgColor}}
                onMouseMove={handleMouseMove} onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp} onWheel={handleWheel} onContextMenu={handleContextMenu}
            >
                <div ref={gridRef} className="grid-layer" style={{pointerEvents:"none"}}/>

                {}
                <div ref={cameraLayerRef} className="camera-layer" style={{
                    transform:`translate(${camera.x}px,${camera.y}px) scale(${camera.zoom})`,
                    transformOrigin:"0 0",position:"absolute",width:"100%",height:"100%",pointerEvents:"none",
                }}>
                    {}
                    {(regions||[]).map(region=>{
                        const b=computeRegionBounds(region.nodeIds);
                        if(!b)return null;
                        const isCompound=!!region.isCompound;
                        return(
                            <div key={region.id} style={{
                                position:"absolute",left:b.x,top:b.y,width:b.w,height:b.h,
                                border:isCompound?"2px solid rgba(203,166,247,0.7)":"2px dashed rgba(255,255,255,0.35)",
                                borderRadius:10,
                                background:isCompound?"rgba(203,166,247,0.04)":"rgba(255,255,255,0.04)",
                                boxShadow:isCompound
                                    ?"inset 0 0 0 1px rgba(203,166,247,0.2),0 0 16px rgba(203,166,247,0.07)"
                                    :"inset 0 0 0 1px rgba(137,180,250,0.18)",
                                pointerEvents:"none",boxSizing:"border-box",
                            }}>
                                {}
                                <div style={{position:"absolute",top:-26,left:"50%",transform:"translateX(-50%)",background:"rgba(0,0,0,0.72)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:6,padding:"3px 10px",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:6,pointerEvents:"auto"}}
                                    onContextMenu={e=>{e.preventDefault();e.stopPropagation();setRegionMenu({regionId:region.id,x:e.clientX,y:e.clientY});}}>
                                    {isCompound&&<span style={{fontSize:9,fontWeight:700,color:"#cba6f7",background:"rgba(203,166,247,0.15)",borderRadius:3,padding:"1px 5px",letterSpacing:"0.06em"}}>COMPOUND</span>}
                                    <span style={{fontSize:11,fontWeight:600,color:"#e0e0e0",letterSpacing:"0.04em",userSelect:"none"}}>{region.label}</span>
                                    <span style={{fontSize:11,color:"#585b70",cursor:"pointer",lineHeight:1}}
                                        onMouseEnter={e=>e.currentTarget.style.color="#f38ba8"}
                                        onMouseLeave={e=>e.currentTarget.style.color="#585b70"}
                                        onMouseDown={e=>{e.stopPropagation();if(setRegions)setRegions(prev=>prev.filter(r=>r.id!==region.id));}}
                                    >✕</span>
                                </div>
                            </div>
                        );
                    })}

                    {}
                    <svg className="wire-layer" style={{pointerEvents:"none"}}>
                        {}
                        {visibleWires.map(wire=>{
                            const n1=nodeMap.get(wire.from.nodeId),n2=nodeMap.get(wire.to.nodeId);
                            if(!n1||!n2)return null;
                            const p1=pinPos(n1,wire.from,true),p2=pinPos(n2,wire.to,false);
                            const wireActive=n1.type.startsWith("IN_")?(n1.outputs?.[wire.from.index]??0)===1:n1.value===1;
                            return <Wire key={wire.id} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} active={wireActive} waypoints={wire.waypoints||[]} activeColor={wireActiveColor} inactiveColor={wireInactiveColor} wireStyle={wireStyle}/>;
                        })}
                        {}
                        {activeWire&&(()=>{
                            const node=nodeMap.get(activeWire.nodeId);
                            if(!node)return null;
                            const p=pinPos(node,activeWire,true);
                            return <Wire x1={p.x} y1={p.y} x2={mousePos.x} y2={mousePos.y} active={false} waypoints={activeWireWaypoints} activeColor={wireActiveColor} inactiveColor={wireInactiveColor} wireStyle={wireStyle}/>;
                        })()}
                        {}
                        {(()=>{
                            const srcMap={};
                            wires.forEach(w=>{
                                const src=nodeMap.get(w.from.nodeId);
                                if(!src||src.type==="JUNCTION")return;
                                const key=`${w.from.nodeId}:${w.from.index}`;
                                if(!srcMap[key]){const pos=pinPos(src,w.from,true);srcMap[key]={count:0,pos,active:src.value===1};}
                                srcMap[key].count++;
                            });
                            return Object.values(srcMap).filter(s=>s.count>1).map((s,i)=>(
                                <circle key={i} cx={s.pos.x} cy={s.pos.y} r={4} fill={s.active?wireActiveColor:wireInactiveColor}/>
                            ));
                        })()}
                        {}
                        {activeWireWaypoints.map((wp,i)=>(
                            <g key={`wpv-${i}`}>
                                <circle cx={wp.x} cy={wp.y} r={5} fill="rgba(137,180,250,0.15)" stroke="#89b4fa" strokeWidth="1"/>
                                <circle cx={wp.x} cy={wp.y} r={2} fill="#89b4fa"/>
                            </g>
                        ))}

                        {}
                        {compoundPinData.map(({regionId, inputs, outputs})=>(
                            <g key={`cvis-${regionId}`}>
                                {inputs.map((p,i)=>(
                                    <line key={`il-${i}`}
                                        x1={p.wx-24} y1={p.wy} x2={p.wx} y2={p.wy}
                                        stroke={p.isActive?wireActiveColor:wireInactiveColor}
                                        strokeWidth="2.5"/>
                                ))}
                                {outputs.map((p,i)=>(
                                    <line key={`ol-${i}`}
                                        x1={p.wx} y1={p.wy} x2={p.wx+24} y2={p.wy}
                                        stroke={p.isActive?wireActiveColor:wireInactiveColor}
                                        strokeWidth="2.5"/>
                                ))}
                            </g>
                        ))}
                    </svg>

                    {}
                    {ledDecimalRegion&&(
                        <LEDDecimalConverterDisplayWrapper
                            hookData={ledDecimalConverterHookData}
                            onTogglePanel={()=>setLedDecimalPanelOpen(!ledDecimalPanelOpen)}
                        />
                    )}

                    {}
                    {visibleNodes.map(node=>(
                        <Node
                            key={node.id}
                            id={node.id} type={node.type} x={node.x} y={node.y}
                            value={node.value} label={node.label} hz={node.hz} duty={node.duty}
                            outputs={node.outputs}
                            nodeColor={nodeColors.get(node.id)}
                            cameraRef={cameraRef}
                            workspaceRef={workspaceRef}
                            updateNodePosition={updateNodePosition}
                            onPinClick={handlePinClick}
                            onBitToggle={handleBitToggle}
                            selected={selectedSet.has(node.id)}
                            onSelect={tool==="erase"?eraseNode:onSelectNode}
                            cancelWire={cancelWire}
                            onContextMenu={openNodeMenu}
                            eraseMode={tool==="erase"}
                            isLEDHovered={ledHoveredNodeId===node.id}
                            pauseTracking={pauseTracking}
                            resumeTracking={resumeTracking}
                            saveSnapshot={saveSnapshot}
                        />
                    ))}

                    {}
                    <svg style={{
                        position:"absolute",left:0,top:0,width:"100%",height:"100%",
                        pointerEvents:"none",overflow:"visible",
                    }}>
                        {compoundPinData.map(({regionId, inputs, outputs})=>(
                            <g key={`cpin-${regionId}`}>

                                {}
                                {inputs.map((p,i)=>{
                                    const col = p.isActive ? wireActiveColor : wireInactiveColor;
                                    const receiving = activeWire?.type==="output";
                                    return (
                                        <g key={`in-${i}`}
                                           style={{pointerEvents:"auto", cursor:"crosshair"}}
                                           onMouseDown={e=>handleCompoundPinClick(e, regionId, i, true)}>
                                            {}
                                            {receiving&&<circle cx={p.wx} cy={p.wy} r={PIN_R+5}
                                                fill="none" stroke="rgba(203,166,247,0.5)" strokeWidth="1.5"/>}
                                            {}
                                            <circle cx={p.wx} cy={p.wy} r={PIN_R}
                                                fill={receiving?"rgba(203,166,247,0.3)":col}
                                                stroke="#cba6f7" strokeWidth="2"/>
                                            {}
                                            <polygon
                                                points={`${p.wx-4},${p.wy-3.5} ${p.wx+3.5},${p.wy} ${p.wx-4},${p.wy+3.5}`}
                                                fill={receiving?"#cba6f7":"rgba(0,0,0,0.6)"}
                                                style={{pointerEvents:"none"}}/>
                                            {}
                                            <text x={p.wx-28} y={p.wy+4} fontSize="10" fill="#a6adc8"
                                                textAnchor="end" fontWeight="600"
                                                style={{pointerEvents:"none",userSelect:"none"}}>{p.label}</text>
                                        </g>
                                    );
                                })}

                                {}
                                {outputs.map((p,i)=>{
                                    const col = p.isActive ? wireActiveColor : wireInactiveColor;
                                    const canStart = p.hasSource && !activeWire;
                                    return (
                                        <g key={`out-${i}`}
                                           style={{pointerEvents:"auto", cursor: canStart?"crosshair":"default"}}
                                           onMouseDown={e=>handleCompoundPinClick(e, regionId, i, false)}>
                                            {}
                                            {canStart&&<circle cx={p.wx} cy={p.wy} r={PIN_R+5}
                                                fill="none" stroke="rgba(203,166,247,0.3)" strokeWidth="1"/>}
                                            {}
                                            <circle cx={p.wx} cy={p.wy} r={PIN_R}
                                                fill={canStart?"rgba(203,166,247,0.2)":col}
                                                stroke="#cba6f7" strokeWidth="2"/>
                                            {}
                                            <polygon
                                                points={`${p.wx-3.5},${p.wy-3.5} ${p.wx+4},${p.wy} ${p.wx-3.5},${p.wy+3.5}`}
                                                fill={canStart?"#cba6f7":"rgba(0,0,0,0.6)"}
                                                style={{pointerEvents:"none"}}/>
                                            {}
                                            <text x={p.wx+28} y={p.wy+4} fontSize="10" fill="#a6adc8"
                                                textAnchor="start" fontWeight="600"
                                                style={{pointerEvents:"none",userSelect:"none"}}>{p.label}</text>
                                        </g>
                                    );
                                })}

                            </g>
                        ))}
                    </svg>

                </div>{}

                {selectionBox&&(
                    <div style={{position:"absolute",left:Math.min(selectionBox.startX,selectionBox.endX),top:Math.min(selectionBox.startY,selectionBox.endY),width:Math.abs(selectionBox.endX-selectionBox.startX),height:Math.abs(selectionBox.endY-selectionBox.startY),border:"1px dashed #89b4fa",background:"rgba(137,180,250,0.08)",pointerEvents:"none"}}/>
                )}

                {selectedNodes.length>1&&!pendingTypes?.length&&(
                    <div style={{position:"absolute",bottom:16,left:"50%",transform:"translateX(-50%)",background:"#1a1a2a",color:"#a6adc8",fontSize:12,padding:"5px 12px",borderRadius:6,border:"1px solid #2a2a3e",pointerEvents:"none",display:"flex",gap:10,whiteSpace:"nowrap"}}>
                        {selectedNodes.length} selected · Del to delete · Ctrl+C copy · Ctrl+G to group
                    </div>
                )}
                {activeWire&&!pendingTypes?.length&&(
                    <div style={{position:"absolute",bottom:16,left:"50%",transform:"translateX(-50%)",background:"#1a1a2a",color:"#6c7086",fontSize:11,padding:"5px 12px",borderRadius:6,border:"1px solid #2a2a3e",pointerEvents:"none"}}>
                        Right-click to add pivot{activeWireWaypoints.length>0?` · ${activeWireWaypoints.length} pivot${activeWireWaypoints.length>1?'s':''}`:''} · Esc to cancel
                        {compoundPinData.some(d=>d.inputs.length)&&
                            <span style={{color:"#cba6f7",marginLeft:8}}>· click ◉ input pin to connect</span>}
                    </div>
                )}

                {}
                {nodeMenu&&(()=>{
                    const node=nodes.find(n=>n.id===nodeMenu.nodeId);
                    return(
                        <div style={{position:"fixed",left:nodeMenu.x,top:nodeMenu.y,background:"#1e1e2e",border:"1px solid #45475a",borderRadius:8,padding:6,minWidth:170,boxShadow:"0 4px 20px rgba(0,0,0,0.5)",zIndex:2000,display:"flex",flexDirection:"column",gap:2}}
                            onClick={e=>e.stopPropagation()} onMouseDown={e=>e.stopPropagation()}>
                            {nodeMenu.mode==="menu"?(<>
                                <div style={MN.hdr}>{node?.type}</div>
                                {node?.type!=="JUNCTION"&&<div style={MN.item} onMouseDown={handleSetLabel}>🏷️ {node?.label?"Edit label":"Add label"}</div>}
                                {node?.type!=="JUNCTION"&&<div style={MN.item} onMouseDown={handleDuplicateNode}>⧉ Duplicate</div>}
                                {selectedNodes.length>=2&&<div style={MN.item} onMouseDown={()=>{setRegionPrompt({nodeIds:[...selectedNodes],x:nodeMenu.x,y:nodeMenu.y});setNodeMenu(null);}}>⬜ Group region</div>}
                                {(()=>{
                                    const selNs=nodes.filter(n=>selectedNodes.includes(n.id));
                                    const hasCircuit=selNs.some(n=>n.type!=='SWITCH'&&n.type!=='LED'&&n.type!=='JUNCTION'&&n.type!=='CLOCK'&&selectedNodes.includes(n.id));
                                    const hasSWorLED=selNs.some(n=>n.type==='SWITCH'||n.type==='LED');
                                    const circuitCount=selNs.filter(n=>n.type!=='SWITCH'&&n.type!=='LED'&&n.type!=='JUNCTION'&&n.type!=='CLOCK').length;
                                    if(hasCircuit&&hasSWorLED&&circuitCount===1)
                                        return <div style={{...MN.item,color:"#a6e3a1"}} onMouseDown={()=>{handleJoin();setNodeMenu(null);}}>⚡ Join wires</div>;
                                })()}
                                {node?.type==="CLOCK"&&<div style={MN.item} onMouseDown={()=>{setClockConfig({node,x:nodeMenu.x,y:nodeMenu.y});setNodeMenu(null);}}>⏱ Configure clock</div>}
                                {node&&!["SWITCH","LED","CLOCK","JUNCTION"].includes(node.type)&&<div style={MN.item} onMouseDown={()=>{setTruthTableType(node.type);setNodeMenu(null);}}>≡ Truth table</div>}
                                {(()=>{
                                    const selNs=nodes.filter(n=>selectedNodes.includes(n.id));
                                    const isAllLEDs=selectedNodes.length>0&&selNs.every(n=>n.type==="LED");
                                    if(isAllLEDs){
                                        return <div style={{...MN.item,color:"#a6e3a1"}} onMouseDown={()=>{
                                            const regionId=wid();
                                            if(setRegions)setRegions(prev=>[...prev,{id:regionId,label:"LED to Decimal",nodeIds:[...selectedNodes],isLEDDecimal:true}]);
                                            setLedDecimalRegion(regionId);
                                            setLedDecimalPanelOpen(true);
                                            setNodeMenu(null);
                                        }}>🔢 To Decimal</div>;
                                    }
                                    return null;
                                })()}
                                <div style={{height:1,background:"#313244",margin:"3px 0"}}/>
                                <div style={{...MN.item,color:"#f38ba8"}} onMouseDown={handleDeleteNode}>🗑️ Delete</div>
                            </>):(<>
                                <div style={MN.hdr}>Label</div>
                                <input ref={labelInputRef} value={nodeMenu.labelValue}
                                    onChange={e=>setNodeMenu(p=>({...p,labelValue:e.target.value}))}
                                    onKeyDown={e=>{if(e.key==="Enter")confirmLabel();if(e.key==="Escape")setNodeMenu(null);}}
                                    placeholder="e.g. Input A"
                                    style={{padding:"7px 10px",borderRadius:5,fontSize:13,border:"1px solid #45475a",background:"#313244",color:"#cdd6f4",outline:"none",width:"100%",boxSizing:"border-box"}}
                                />
                                <div style={{display:"flex",gap:6,marginTop:6}}>
                                    <button onMouseDown={()=>setNodeMenu(null)} style={MN.btnCancel}>Cancel</button>
                                    <button onMouseDown={confirmLabel} style={MN.btnOk}>Set</button>
                                </div>
                            </>)}
                        </div>
                    );
                })()}

                {}
                {regionMenu&&(()=>{
                    const region=(regions||[]).find(r=>r.id===regionMenu.regionId);
                    if(!region)return null;
                    const regionNodes=nodesRef.current.filter(n=>region.nodeIds.includes(n.id));
                    const switches=regionNodes.filter(n=>n.type==='SWITCH');
                    const leds=regionNodes.filter(n=>n.type==='LED');
                    const canCompound=switches.length>0||leds.length>0;
                    return(
                        <div style={{position:"fixed",left:regionMenu.x,top:regionMenu.y,background:"#1e1e2e",border:"1px solid #45475a",borderRadius:8,padding:6,minWidth:200,boxShadow:"0 4px 20px rgba(0,0,0,0.5)",zIndex:2000,display:"flex",flexDirection:"column",gap:2}}
                            onClick={e=>e.stopPropagation()} onMouseDown={e=>e.stopPropagation()}>
                            <div style={MN.hdr}>{region.label}</div>

                            {!region.isCompound&&canCompound&&(
                                <div style={{...MN.item,color:"#cba6f7"}} onMouseDown={()=>handleMakeCompound(regionMenu.regionId)}>
                                    ⬡ Make Compound
                                    <span style={{fontSize:10,color:"#6c7086",marginLeft:6}}>
                                        {switches.length} in · {leds.length} out
                                    </span>
                                </div>
                            )}
                            {!region.isCompound&&!canCompound&&(
                                <div style={{...MN.item,color:"#585b70",cursor:"default",fontSize:12,lineHeight:"1.5"}}>
                                    ⬡ Make Compound<br/>
                                    <span style={{fontSize:10}}>Region needs switches or LEDs</span>
                                </div>
                            )}
                            {region.isCompound&&(
                                <>
                                    <div style={{padding:"3px 12px",fontSize:11,color:"#a6adc8",userSelect:"none"}}>
                                        {(region.inputNodeIds||[]).length} input · {(region.outputNodeIds||[]).length} output pins
                                    </div>
                                    <div style={MN.item} onMouseDown={()=>handleRemoveCompound(regionMenu.regionId)}>
                                        ↩ Remove Compound
                                    </div>
                                </>
                            )}

                            <div style={{height:1,background:"#313244",margin:"3px 0"}}/>
                            <div style={{...MN.item,color:"#f38ba8"}} onMouseDown={()=>{
                                if(setRegions)setRegions(prev=>prev.filter(r=>r.id!==regionMenu.regionId));
                                setRegionMenu(null);
                            }}>🗑️ Delete Region</div>
                        </div>
                    );
                })()}
            </div>

            {pendingTypes?.length>0&&(
                <>
                    <div style={{position:"absolute",inset:0,zIndex:50,cursor:"crosshair"}}
                        onMouseMove={handleGhostMouseMove}
                        onMouseLeave={()=>setGhostWorldPos(null)}
                        onClick={handleGhostPlace}
                        onContextMenu={e=>{e.preventDefault();onCancelPending?.();setGhostWorldPos(null);}}
                    >
                        {ghostWorldPos&&(
                            <div style={{transform:`translate(${camera.x}px,${camera.y}px) scale(${camera.zoom})`,transformOrigin:"0 0",position:"absolute",pointerEvents:"none"}}>
                                {getGhostPositions().map((g,i)=><GhostNode key={i} type={g.type} x={g.x} y={g.y} width={g.w} height={g.h}/>)}
                            </div>
                        )}
                    </div>
                    <div style={{position:"absolute",bottom:16,left:"50%",transform:"translateX(-50%)",background:"#1a1a2a",color:"#89b4fa",fontSize:11,fontWeight:600,padding:"6px 14px",borderRadius:6,border:"1px solid rgba(137,180,250,0.3)",pointerEvents:"none",zIndex:51,display:"flex",alignItems:"center",gap:8}}>
                        <span style={{background:"rgba(137,180,250,0.15)",borderRadius:4,padding:"1px 7px",fontSize:10,fontWeight:700}}>{pendingTypes.length}</span>
                        {pendingTypes.length===1?pendingTypes[0]:`nodes (${pendingTypes.join(", ")})`} · click to place · Esc to cancel
                    </div> 
                </>
            )}
        </div>
    ); 
}

const MN={
    hdr:{padding:"5px 10px",fontSize:11,color:"#6c7086",borderBottom:"1px solid #313244",marginBottom:3,fontWeight:"bold",textTransform:"uppercase",letterSpacing:"0.06em"},
    item:{padding:"7px 12px",borderRadius:5,cursor:"pointer",fontSize:13,color:"#cdd6f4",userSelect:"none"},
    btnCancel:{flex:1,padding:6,borderRadius:5,border:"1px solid #45475a",background:"transparent",color:"#cdd6f4",cursor:"pointer",fontSize:12},
    btnOk:{flex:1,padding:6,borderRadius:5,border:"none",background:"#89b4fa",color:"#1e1e2e",fontWeight:"bold",cursor:"pointer",fontSize:12},
};

export default Workspace;