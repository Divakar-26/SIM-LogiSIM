// src/components/Workspace/Workspace.jsx
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import '../../styles/workspace.css';
import Node from "../Node";
import Wire from "../Wire";
import { getPinPosition } from "../../utils/pinPosition";
import { propagate } from "./propagate";
import TruthTablePanel from "./TruthTablePanel";
import ClockConfig from "./ClockConfig";
import { useSettings } from "../../configs/SettingsContext";
import { syncClocks, setClockChangeHandler, stopAllClocks } from "../../utils/clockManager";
import { gateColors, gateConfig, customColor } from "../../configs/gates";
import { getNodeSize } from "../../utils/nodeSize";
import { customComponentRegistry } from "../../configs/customComponents";

const GRID = 20;
const REGION_PAD = 22;

function ToolBtn({ active, onClick, title, children }) {
    return (
        <button title={title} onClick={onClick} style={{
            width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",
            background:active?"rgba(137,180,250,0.15)":"transparent",
            border:active?"1px solid rgba(137,180,250,0.5)":"1px solid transparent",
            borderRadius:7,color:active?"#89b4fa":"#6c7086",
            cursor:"pointer",fontSize:17,transition:"all 0.12s",flexShrink:0,
        }}
            onMouseEnter={e=>{if(!active)e.currentTarget.style.background="rgba(255,255,255,0.05)";}}
            onMouseLeave={e=>{if(!active)e.currentTarget.style.background="transparent";}}
        >{children}</button>
    );
}

function GhostNode({ type, x, y, width, height }) {
    const isIO = ["SWITCH","LED","CLOCK"].includes(type);
    const COLORS = {SWITCH:"#1a7a40",LED:"#a01020",CLOCK:"#1a2a3a",AND:"#1a5fa0",OR:"#6b2fa0",NOT:"#b85a10"};
    const cc = customComponentRegistry[type];
    const bg = COLORS[type]||gateColors[type]||(cc?"#3d2b8e":"#3d2b8e");
    return (
        <div style={{position:"absolute",left:x,top:y,width,height,borderRadius:isIO?"50%":6,background:bg,border:"2px dashed rgba(137,180,250,0.7)",opacity:0.55,display:"flex",alignItems:"center",justifyContent:"center",boxSizing:"border-box",pointerEvents:"none",userSelect:"none"}}>
            {!isIO&&<span style={{fontSize:type.length>6?8:11,fontWeight:800,color:"rgba(255,255,255,0.85)",textTransform:"uppercase",padding:"0 4px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:width-8}}>{type}</span>}
        </div>
    );
}

function RegionPrompt({ x, y, onConfirm, onClose }) {
    const [val, setVal] = useState("");
    const inputRef = useRef(null);
    useEffect(()=>{setTimeout(()=>inputRef.current?.focus(),30);},[]);
    const top = Math.min(y, window.innerHeight-130);
    return (
        <div style={{position:"fixed",left:x,top,zIndex:3000,background:"#1e1e2e",border:"1px solid #45475a",borderRadius:9,padding:"12px 14px",width:210,boxShadow:"0 6px 24px rgba(0,0,0,0.6)",display:"flex",flexDirection:"column",gap:10,userSelect:"none"}}
            onClick={e=>e.stopPropagation()} onMouseDown={e=>e.stopPropagation()}>
            <div style={{fontSize:11,fontWeight:700,color:"#cdd6f4",letterSpacing:"0.05em"}}>Name region</div>
            <input ref={inputRef} value={val} onChange={e=>setVal(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter")onConfirm(val);if(e.key==="Escape")onClose();}}
                placeholder="e.g. ALU, Decoder…"
                style={{padding:"6px 9px",borderRadius:6,fontSize:12,border:"1px solid #45475a",background:"#181825",color:"#cdd6f4",outline:"none",width:"100%",boxSizing:"border-box"}}
                onFocus={e=>e.currentTarget.style.borderColor="#89b4fa"}
                onBlur={e=>e.currentTarget.style.borderColor="#45475a"}
            />
            <div style={{display:"flex",gap:8}}>
                <button onClick={onClose} style={{flex:1,padding:"6px 0",borderRadius:6,border:"1px solid #45475a",background:"transparent",color:"#cdd6f4",cursor:"pointer",fontSize:12}}>Cancel</button>
                <button onClick={()=>onConfirm(val)} style={{flex:1,padding:"6px 0",borderRadius:6,border:"none",background:"#89b4fa",color:"#1e1e2e",fontWeight:700,cursor:"pointer",fontSize:12}}>Add</button>
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

// ── Workspace ─────────────────────────────────────────────────────────────────
function Workspace({
    nodes, setNodes, wires, setWires,
    regions, setRegions,
    pendingTypes, onPlacePending, onCancelPending,
    clipboardRef,   // ← lifted to App so clipboard survives tab switches
}) {
    const workspaceRef   = useRef(null);
    const cameraLayerRef = useRef(null);
    const gridRef        = useRef(null);   // ← infinite grid, updated directly in applyCameraDOM
    const cameraRef      = useRef({x:0,y:0,zoom:1});
    const isPanningRef   = useRef(false);
    const panStartRef    = useRef({x:0,y:0});
    const activeWireRef  = useRef(null);
    const wiresRef       = useRef(wires);
    const nodesRef       = useRef(nodes);
    const selectedRef    = useRef([]);
    const settingsRef    = useRef(null);
    const toolRef        = useRef("select");

    useEffect(()=>{wiresRef.current=wires;},[wires]);
    useEffect(()=>{nodesRef.current=nodes;},[nodes]);

    const [camera,setCamera]                       = useState({x:0,y:0,zoom:1});
    const [tool,setTool]                           = useState("select");
    const [activeWire,setActiveWire]               = useState(null);
    const [activeWireWaypoints,setActiveWireWaypoints] = useState([]);
    const [mousePos,setMousePos]                   = useState({x:0,y:0});
    const [selectedNodes,setSelectedNodes]         = useState([]);
    const [selectionBox,setSelectionBox]           = useState(null);
    const [nodeMenu,setNodeMenu]                   = useState(null);
    const [truthTableType,setTruthTableType]       = useState(null);
    const [clockConfig,setClockConfig]             = useState(null);
    const [ghostWorldPos,setGhostWorldPos]         = useState(null);
    const [regionPrompt,setRegionPrompt]           = useState(null);
    const labelInputRef = useRef(null);
    const {settings} = useSettings();

    useEffect(()=>{activeWireRef.current=activeWire;},[activeWire]);
    useEffect(()=>{selectedRef.current=selectedNodes;});
    useEffect(()=>{settingsRef.current=settings;},[settings]);
    useEffect(()=>{toolRef.current=tool;},[tool]);

    const nodeMap = useMemo(()=>{
        const m=new Map();nodes.forEach(n=>m.set(n.id,n));return m;
    },[nodes]);

    const selectedSet = useMemo(()=>new Set(selectedNodes),[selectedNodes]);

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

    // ── Propagation fingerprint ───────────────────────────────────────────────
    const prevSigRef = useRef('');
    useEffect(()=>{
        const nodeSig=nodes.map(n=>`${n.id}:${n.value}:${(n.outputs||[]).join(',')}`).join('|');
        const wireSig=wires.map(w=>`${w.from.nodeId}[${w.from.index}]->${w.to.nodeId}[${w.to.index}]`).join('|');
        const sig=nodeSig+'~'+wireSig;
        if(sig===prevSigRef.current)return;
        const newNodes=propagate(nodes,wires);
        // Three-way split:
        //  valOutChanged  → value or outputs changed: clear sig, re-propagate after save
        //  stateOnlyChanged → only internalState changed (e.g. master latch updated but
        //                     FF output same): save to React state but DON'T clear sig —
        //                     no need to re-propagate, but the state must survive to the
        //                     next input event.  Without this, feedback compounds forget
        //                     their history whenever output happens to stay the same.
        //  neither         → truly nothing changed: cache sig, skip setNodes entirely
        let valOutChanged=false, stateOnlyChanged=false;
        const merged=nodes.map(orig=>{
            const n=newNodes.find(x=>x.id===orig.id);
            if(!n)return orig;
            const vEq=n.value===orig.value;
            const oEq=n.outputs===orig.outputs||((!n.outputs&&!orig.outputs)||(n.outputs&&orig.outputs&&n.outputs.length===orig.outputs.length&&n.outputs.every((v,i)=>v===orig.outputs[i])));
            // Reference check is sufficient: propagate only creates a new internalState
            // object when internalStateEq() detected actual content change.
            const iEq=n.internalState===orig.internalState;
            if(vEq&&oEq&&iEq)return orig;
            if(!vEq||!oEq)valOutChanged=true; else stateOnlyChanged=true;
            return n;
        });
        if(valOutChanged){prevSigRef.current='';setNodes(merged);}
        else if(stateOnlyChanged){setNodes(merged);}  // persist internalState, no re-propagation needed
        else prevSigRef.current=sig;
    },[nodes,wires]);

    // ── Clock management ──────────────────────────────────────────────────────
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

    // ── Camera + infinite grid ────────────────────────────────────────────────
    // applyCameraDOM writes to three DOM elements simultaneously — zero React re-renders:
    //   1. cameraLayerRef  — transform for nodes/wires
    //   2. gridRef         — background-position/size for infinite tiling grid
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

    // Keep grid in sync when settings (grid color/visibility) change without pan
    useEffect(()=>{applyCameraDOM(cameraRef.current);},[settings.showGrid,settings.gridColor,settings.bgColor]);

    // ── Stable callbacks ──────────────────────────────────────────────────────
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

    // ── Join: smart-wire selected switches/LEDs → selected circuit's pins ──────
    // Rules (sorted top-to-bottom by Y position):
    //   switches selected + circuit     → wire each switch output → circuit input i
    //   LEDs selected    + circuit     → wire each circuit output i → LED input
    //   switches + LEDs  + circuit     → both of the above
    // Any count mismatch on one side is silently skipped (partial join is fine).
    const handleJoin = useCallback(()=>{
        const sel = selectedRef.current;
        if (sel.length < 2) return;
        const allNodes = nodesRef.current;
        const selNodes = allNodes.filter(n => sel.includes(n.id));

        const switches  = selNodes.filter(n => n.type === 'SWITCH').sort((a,b)=>a.y-b.y);
        const leds      = selNodes.filter(n => n.type === 'LED').sort((a,b)=>a.y-b.y);
        // Circuit = the one non-IO node in the selection (there must be exactly one)
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

        // switches → input pins (by sorted Y order: topmost switch → pin 0)
        switches.forEach((sw, i) => {
            if (i >= cfg.inputs) return;
            const dup = currentWires.some(w =>
                w.from.nodeId === sw.id && w.to.nodeId === circuit.id && w.to.index === i
            );
            if (!dup) newWires.push({
                id: wid(),
                from: { nodeId: sw.id,      index: 0, total: 1          },
                to:   { nodeId: circuit.id, index: i, total: cfg.inputs  },
            });
        });

        // output pins → LEDs (by sorted Y order: topmost LED ← output pin 0)
        leds.forEach((led, i) => {
            if (i >= cfg.outputs) return;
            const dup = currentWires.some(w =>
                w.from.nodeId === circuit.id && w.from.index === i && w.to.nodeId === led.id
            );
            if (!dup) newWires.push({
                id: wid(),
                from: { nodeId: circuit.id, index: i, total: cfg.outputs },
                to:   { nodeId: led.id,     index: 0, total: 1           },
            });
        });

        if (newWires.length) setWires(prev => [...prev, ...newWires]);
    }, []);

    // ── Copy / Paste — uses clipboardRef from App (cross-tab) ─────────────────
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
            ...r,id:wid(),nodeIds:r.nodeIds.map(id=>idMap.get(id)??id),
        }));
        setNodes(prev=>[...prev,...newNodes]);
        setWires(prev=>[...prev,...newWires]);
        if(newRegions.length&&setRegions)setRegions(prev=>[...prev,...newRegions]);
        setSelectedNodes(newNodes.map(n=>n.id));
    },[clipboardRef,regions]);

    // ── Region ────────────────────────────────────────────────────────────────
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

    // ── Node menu actions ─────────────────────────────────────────────────────
    const handleDeleteNode=()=>{
        const id=nodeMenu.nodeId;
        setNodes(prev=>prev.filter(n=>n.id!==id));
        setWires(prev=>prev.filter(w=>w.from.nodeId!==id&&w.to.nodeId!==id));
        setSelectedNodes(prev=>prev.filter(nid=>nid!==id));
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

    // ── Keyboard ──────────────────────────────────────────────────────────────
    useEffect(()=>{
        const onKey=(e)=>{
            if(document.activeElement.tagName==="INPUT")return;
            const mod=e.ctrlKey||e.metaKey;
            if(e.key==="Delete"||e.key==="Backspace")handleDeleteSelected();
            if(e.key==="Escape"){cancelWire();setNodeMenu(null);setClockConfig(null);setTool("select");onCancelPending?.();setGhostWorldPos(null);setRegionPrompt(null);}
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
                setNodeMenu(null);setSelectedNodes([]);
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
            cancelWire();setNodeMenu(null);setClockConfig(null);setSelectedNodes([]);
            if(tool==="select")setSelectionBox({startX:sx,startY:sy,endX:sx,endY:sy});
        }
    };

    const handleMouseMove=(e)=>{
        const rect=workspaceRef.current.getBoundingClientRect();
        const sx=e.clientX-rect.left,sy=e.clientY-rect.top;
        if(isPanningRef.current){
            const cam={x:sx-panStartRef.current.x,y:sy-panStartRef.current.y,zoom:cameraRef.current.zoom};
            applyCameraDOM(cam); // zero React re-renders, grid updates too
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
        }else if(selectedRef.current.length>=2){
            setRegionPrompt({nodeIds:[...selectedRef.current],x:e.clientX,y:e.clientY});
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

    return (
        <div style={{flex:1,display:"flex",flexDirection:"column",position:"relative",overflow:"hidden",height:"100%"}}>

            {settings.showToolbar&&(
                <div style={{position:"absolute",top:14,left:"50%",transform:"translateX(-50%)",display:"flex",alignItems:"center",gap:4,background:"#1a1a2a",border:"1px solid #2a2a3e",borderRadius:10,padding:"4px 6px",zIndex:100,boxShadow:"0 2px 12px rgba(0,0,0,0.4)",userSelect:"none"}}>
                    <ToolBtn active={tool==="select"} onClick={()=>setTool("select")} title="Select">↖</ToolBtn>
                    <ToolBtn active={tool==="pan"}    onClick={()=>setTool("pan")}    title="Pan">✥</ToolBtn>
                    <ToolBtn active={tool==="erase"}  onClick={()=>setTool("erase")}  title="Erase">✕</ToolBtn>
                    <div style={{width:1,height:22,background:"#2a2a3e",margin:"0 2px"}}/>
                    <ToolBtn active={false} onClick={fitAll} title="Fit all (F)">⛶</ToolBtn>
                </div>
            )}

            <button onClick={focusOrigin} title="Focus origin (H)" style={{position:"absolute",bottom:20,right:20,zIndex:100,width:40,height:40,borderRadius:"50%",background:"#1a1a2a",border:"1px solid #45475a",color:"#89b4fa",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 10px rgba(0,0,0,0.5)",transition:"border-color 0.15s, background 0.15s",fontSize:18}}
                onMouseEnter={e=>{e.currentTarget.style.background="#25253a";e.currentTarget.style.borderColor="#89b4fa";}}
                onMouseLeave={e=>{e.currentTarget.style.background="#1a1a2a";e.currentTarget.style.borderColor="#45475a";}}
            >⌖</button>

            {truthTableType&&<TruthTablePanel type={truthTableType} onClose={()=>setTruthTableType(null)}/>}
            {clockConfig&&<ClockConfig node={clockConfig.node} x={clockConfig.x} y={clockConfig.y} onSave={handleClockSave} onClose={()=>setClockConfig(null)}/>}
            {regionPrompt&&<RegionPrompt x={regionPrompt.x} y={regionPrompt.y} onConfirm={confirmRegion} onClose={()=>setRegionPrompt(null)}/>}

            {/* ── Canvas ── */}
            <div className="workspace" ref={workspaceRef}
                style={{cursor:cursorMap[tool],background:settings.bgColor}}
                onMouseMove={handleMouseMove} onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp} onWheel={handleWheel} onContextMenu={handleContextMenu}
            >
                {/* Infinite grid — lives in screen space, updated via DOM ref (zero React re-renders) */}
                <div ref={gridRef} className="grid-layer" style={{pointerEvents:"none"}}/>

                {/* Camera layer */}
                <div ref={cameraLayerRef} className="camera-layer" style={{
                    transform:`translate(${camera.x}px,${camera.y}px) scale(${camera.zoom})`,
                    transformOrigin:"0 0",position:"absolute",width:"100%",height:"100%",pointerEvents:"none",
                }}>
                    {/* Regions */}
                    {(regions||[]).map(region=>{
                        const b=computeRegionBounds(region.nodeIds);
                        if(!b)return null;
                        return(
                            <div key={region.id} style={{position:"absolute",left:b.x,top:b.y,width:b.w,height:b.h,border:"2px dashed rgba(255,255,255,0.35)",borderRadius:10,background:"rgba(255,255,255,0.04)",boxShadow:"inset 0 0 0 1px rgba(137,180,250,0.18)",pointerEvents:"none",boxSizing:"border-box"}}>
                                <div style={{position:"absolute",top:-26,left:"50%",transform:"translateX(-50%)",background:"rgba(0,0,0,0.72)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:6,padding:"3px 10px",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:6,pointerEvents:"auto"}}>
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

                    <svg className="wire-layer" style={{pointerEvents:"none"}}>
                        {wires.map(wire=>{
                            const n1=nodeMap.get(wire.from.nodeId),n2=nodeMap.get(wire.to.nodeId);
                            if(!n1||!n2)return null;
                            const p1=pinPos(n1,wire.from,true),p2=pinPos(n2,wire.to,false);
                            const wireActive=n1.type.startsWith("IN_")?(n1.outputs?.[wire.from.index]??0)===1:n1.value===1;
                            return <Wire key={wire.id} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} active={wireActive} waypoints={wire.waypoints||[]} activeColor={wireActiveColor} inactiveColor={wireInactiveColor} wireStyle={wireStyle}/>;
                        })}
                        {activeWire&&(()=>{
                            const node=nodeMap.get(activeWire.nodeId);
                            if(!node)return null;
                            const p=pinPos(node,activeWire,true);
                            return <Wire x1={p.x} y1={p.y} x2={mousePos.x} y2={mousePos.y} active={false} waypoints={activeWireWaypoints} activeColor={wireActiveColor} inactiveColor={wireInactiveColor} wireStyle={wireStyle}/>;
                        })()}
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
                        {activeWireWaypoints.map((wp,i)=>(
                            <g key={`wpv-${i}`}>
                                <circle cx={wp.x} cy={wp.y} r={5} fill="rgba(137,180,250,0.15)" stroke="#89b4fa" strokeWidth="1"/>
                                <circle cx={wp.x} cy={wp.y} r={2} fill="#89b4fa"/>
                            </g>
                        ))}
                    </svg>

                    {nodes.map(node=>(
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
                        />
                    ))}
                </div>

                {selectionBox&&(
                    <div style={{position:"absolute",left:Math.min(selectionBox.startX,selectionBox.endX),top:Math.min(selectionBox.startY,selectionBox.endY),width:Math.abs(selectionBox.endX-selectionBox.startX),height:Math.abs(selectionBox.endY-selectionBox.startY),border:"1px dashed #89b4fa",background:"rgba(137,180,250,0.08)",pointerEvents:"none"}}/>
                )}

                {selectedNodes.length>1&&!pendingTypes?.length&&(
                    <div style={{position:"absolute",bottom:16,left:"50%",transform:"translateX(-50%)",background:"#1a1a2a",color:"#a6adc8",fontSize:12,padding:"5px 12px",borderRadius:6,border:"1px solid #2a2a3e",pointerEvents:"none",display:"flex",gap:10,whiteSpace:"nowrap"}}>
                        {selectedNodes.length} selected · Del to delete · Ctrl+C copy · right-click to group
                    </div>
                )}
                {activeWire&&!pendingTypes?.length&&(
                    <div style={{position:"absolute",bottom:16,left:"50%",transform:"translateX(-50%)",background:"#1a1a2a",color:"#6c7086",fontSize:11,padding:"5px 12px",borderRadius:6,border:"1px solid #2a2a3e",pointerEvents:"none"}}>
                        Right-click to add pivot{activeWireWaypoints.length>0?` · ${activeWireWaypoints.length} pivot${activeWireWaypoints.length>1?'s':''}`:''} · Esc to cancel
                    </div>
                )}

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
                                    // Show "Join" when selection has exactly 1 circuit + ≥1 switch or LED
                                    const selNs=nodes.filter(n=>selectedNodes.includes(n.id));
                                    const hasCircuit=selNs.some(n=>n.type!=='SWITCH'&&n.type!=='LED'&&n.type!=='JUNCTION'&&n.type!=='CLOCK'&&selectedNodes.includes(n.id));
                                    const hasSWorLED=selNs.some(n=>n.type==='SWITCH'||n.type==='LED');
                                    const circuitCount=selNs.filter(n=>n.type!=='SWITCH'&&n.type!=='LED'&&n.type!=='JUNCTION'&&n.type!=='CLOCK').length;
                                    if(hasCircuit&&hasSWorLED&&circuitCount===1)
                                        return <div style={{...MN.item,color:"#a6e3a1"}} onMouseDown={()=>{handleJoin();setNodeMenu(null);}}>⚡ Join wires</div>;
                                })()}
                                {node?.type==="CLOCK"&&<div style={MN.item} onMouseDown={()=>{setClockConfig({node,x:nodeMenu.x,y:nodeMenu.y});setNodeMenu(null);}}>⏱ Configure clock</div>}
                                {node&&!["SWITCH","LED","CLOCK","JUNCTION"].includes(node.type)&&<div style={MN.item} onMouseDown={()=>{setTruthTableType(node.type);setNodeMenu(null);}}>≡ Truth table</div>}
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