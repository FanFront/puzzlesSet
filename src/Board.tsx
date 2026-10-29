import React, { useRef } from "react";
import { allEdges, cellEdge, cellKey, isLocked, vertexEdge } from "./game";
import type { Genre, ParsedPuzzle, Snapshot } from "./types";

type BoardProps = {
  parsed: ParsedPuzzle; genre: Genre; state: Snapshot; selected: number[];
  errors: number[]; multi: boolean;
  onSelect: (index:number, extend:boolean)=>void;
  onTap: (index:number)=>void;
  onEdge: (key:string, action:"toggle"|"paint")=>void;
};
const SIZE=42;
const COLORS={background:"#f7f4ec",ink:"#233244",selected:"#d4e8ff",user:"#2b669f",fill:"#253b50",star:"#dbad49"};
export function Board({parsed:p,genre:g,state:s,selected,errors,multi,onSelect,onTap,onEdge}:BoardProps) {
  const svg=useRef<SVGSVGElement>(null);
  const drawing=useRef<{down:boolean;lastCell:number|null;seen:Set<string>;moved:boolean;start:number|null}>({down:false,lastCell:null,seen:new Set(),moved:false,start:null});
  const x0=g.mode==="nonogram" ? Math.max(76,Math.max(...(p.rowClues||[]).map(v=>v.length),0)*15+12):8;
  const y0=g.mode==="nonogram" ? Math.max(80,Math.max(...(p.colClues||[]).map(v=>v.length),0)*15+12):8;
  const width=x0+p.cols*SIZE+8,height=y0+p.rows*SIZE+8;
  const marked=new Set(s.edges), errorsSet=new Set(errors), selection=new Set(selected);
  const edges=allEdges(p,g);
  const location=(event:React.PointerEvent<SVGSVGElement>)=>{
    const rect=svg.current!.getBoundingClientRect();
    const x=(event.clientX-rect.left)*width/rect.width-x0;
    const y=(event.clientY-rect.top)*height/rect.height-y0;
    return {x,y,r:Math.floor(y/SIZE),c:Math.floor(x/SIZE)};
  };
  const nearestEdge=(x:number,y:number):string|null=>{
    if(g.mode==="slitherlink"){
      const c=Math.floor(x/SIZE),r=Math.floor(y/SIZE);
      if(r<0||c<0||r>=p.rows||c>=p.cols)return null;
      const dx=x/SIZE-c,dy=y/SIZE-r;
      const distances=[dy,1-dy,dx,1-dx];
      const which=distances.indexOf(Math.min(...distances));
      if(which===0)return vertexEdge(r,c,r,c+1);
      if(which===1)return vertexEdge(r+1,c,r+1,c+1);
      if(which===2)return vertexEdge(r,c,r+1,c);
      return vertexEdge(r,c+1,r+1,c+1);
    }
    return null;
  };
  const valid=(r:number,c:number)=>r>=0&&r<p.rows&&c>=0&&c<p.cols;
  const handleDown=(event:React.PointerEvent<SVGSVGElement>)=>{
    if(event.button!==0 && event.pointerType==="mouse")return;
    event.preventDefault();
    const at=location(event);
    drawing.current={down:true,lastCell:null,seen:new Set(),moved:false,start:null};
    svg.current?.setPointerCapture(event.pointerId);
    if(g.mode==="slitherlink"){
      const key=nearestEdge(at.x,at.y);
      if(key){drawing.current.seen.add(key);onEdge(key,"toggle");}
      return;
    }
    if(!valid(at.r,at.c))return;
    const i=at.r*p.cols+at.c;
    if(g.mode==="masyu"){drawing.current.lastCell=i;return;}
    drawing.current.start=i;
    onSelect(i,multi||event.shiftKey);
  };
  const handleMove=(event:React.PointerEvent<SVGSVGElement>)=>{
    if(!drawing.current.down)return;
    event.preventDefault();
    const at=location(event);
    if(g.mode==="slitherlink"){
      const key=nearestEdge(at.x,at.y);
      if(key&&!drawing.current.seen.has(key)){
        drawing.current.seen.add(key);onEdge(key,"paint");
      }
      return;
    }
    if(!valid(at.r,at.c))return;
    const i=at.r*p.cols+at.c;
    if(g.mode==="masyu"){
      const prev=drawing.current.lastCell;
      if(prev!==null&&prev!==i){
        const r=Math.floor(prev/p.cols),c=prev%p.cols;
        if(Math.abs(r-at.r)+Math.abs(c-at.c)===1){
          const key=cellEdge(r,c,at.r,at.c);
          if(!drawing.current.seen.has(key)){onEdge(key,"paint");drawing.current.seen.add(key);}
        }
        drawing.current.lastCell=i;
      }
      return;
    }
    if(i!==drawing.current.start) {
      drawing.current.moved=true;
      onSelect(i,true);
    }
  };
  const handleUp=(event:React.PointerEvent<SVGSVGElement>)=>{
    if(!drawing.current.down)return;
    const at=location(event);
    const d=drawing.current;
    if((g.mode==="shade"||g.mode==="nonogram")&&!multi&&!d.moved&&d.start!==null&&valid(at.r,at.c)&&d.start===at.r*p.cols+at.c)onTap(d.start);
    d.down=false;
    d.lastCell=null;
    if(svg.current?.hasPointerCapture(event.pointerId))svg.current.releasePointerCapture(event.pointerId);
  };
  const cells=Array.from({length:p.rows*p.cols},(_,i)=>({r:Math.floor(i/p.cols),c:i%p.cols,i}));
  const background=(r:number,c:number,i:number)=>{
    const clue=p.clues[r][c],key=cellKey(r,c),v=s.marks[key];
    if(g.mode==="binary"){
      const value=isLocked(p,g,r,c)?clue:v;
      if(value==="b")return COLORS.fill;
      if(value==="w")return "#ffffff";
    }
    if((g.mode==="shade"||g.mode==="nonogram")&&v==="x")return COLORS.fill;
    return selection.has(i) ? COLORS.selected : COLORS.background;
  };
  return <div className="board-scroll">
    <svg ref={svg} viewBox={"0 0 "+width+" "+height} width={width} height={height}
         className="puzzle-board" role="grid" aria-label={g.title+" puzzle board"}
         onPointerDown={handleDown} onPointerMove={handleMove} onPointerUp={handleUp}
         onPointerCancel={()=>{drawing.current.down=false;}} style={{touchAction:"none"}}>
      <rect width={width} height={height} fill="#e6e2d8" rx="9"/>
      {g.mode==="nonogram"&& <>
        {(p.rowClues||[]).map((clues,r)=><text key={"r"+r} x={x0-10} y={y0+(r+0.67)*SIZE}
          textAnchor="end" fontSize="12" fill="#526275" fontWeight="600">{clues.join(" ")}</text>)}
        {(p.colClues||[]).map((clues,c)=><g key={"c"+c}>
          {clues.map((v,i)=><text key={i} x={x0+(c+0.5)*SIZE} y={y0-10-(clues.length-1-i)*14}
            fontSize="12" fill="#526275" textAnchor="middle" fontWeight="600">{v}</text>)}
        </g>)}
      </>}
      {cells.map(({r,c,i})=>{
        const x=x0+c*SIZE,y=y0+r*SIZE,key=cellKey(r,c);
        const clue=p.clues[r][c],v=s.marks[key],locked=isLocked(p,g,r,c);
        const region=p.regions?.[r]?.[c];
        const border=(direction:"top"|"left"|"right"|"bottom")=>{
          if(!p.regions)return false;
          if(direction==="top")return r===0||p.regions[r-1][c]!==region;
          if(direction==="left")return c===0||p.regions[r][c-1]!==region;
          if(direction==="right")return c===p.cols-1||p.regions[r][c+1]!==region;
          return r===p.rows-1||p.regions[r+1][c]!==region;
        };
        const sudokuBox = g.name==="Sudoku" && p.rows===9 && p.cols===9;
        const hasShade=(g.mode==="shade"||g.mode==="nonogram")&&v==="x";
        const displayed = g.mode==="number" ? (g.clueOnly?v:locked?clue:v) :
          g.mode==="binary" ? (locked?clue:v) : "";
        return <g key={i} role="gridcell" aria-label={"row "+(r+1)+" column "+(c+1)}>
          <rect x={x} y={y} width={SIZE} height={SIZE} fill={background(r,c,i)}
            stroke="#c6c8c6" strokeWidth="0.7"/>
          {selection.has(i)&&<rect x={x+2} y={y+2} width={SIZE-4} height={SIZE-4} fill="none" stroke="#5191d4" strokeWidth="2" rx="2"/>}
          {errorsSet.has(i)&&<rect x={x+2} y={y+2} width={SIZE-4} height={SIZE-4} stroke="#d45253" fill="none" strokeWidth="3"/>}
          {g.clueOnly&&clue!=="-"&&<text x={x+3} y={y+11} fontSize="10" fill="#7b6a3a">{clue}</text>}
          {g.mode==="number"&& displayed && displayed!=="-" &&
            <text x={x+SIZE/2} y={y+SIZE/2+9} fontSize={String(displayed).length>2?15:22}
              fontWeight={locked?"750":"600"} fill={locked?"#263447":"#2d6cab"}
              textAnchor="middle">{displayed}</text>}
          {g.mode==="binary" && (displayed==="w"||displayed==="b") && 
            <circle cx={x+SIZE/2} cy={y+SIZE/2} r="11" stroke={displayed==="b"?"#e0e5e7":"#39485b"}
              strokeWidth="2" fill={displayed==="b"?"#162639":"#fff"}/>}
          {(g.mode==="shade"||g.mode==="nonogram") && g.name==="Starbattle"&&hasShade &&
            <text x={x+SIZE/2} y={y+SIZE/2+9} textAnchor="middle" fontSize="27" fill="#e5b95b">★</text>}
          {(g.mode==="shade"||g.mode==="nonogram") && g.name==="Akari"&&hasShade &&
            <text x={x+SIZE/2} y={y+SIZE/2+9} textAnchor="middle" fontSize="26" fill="#f4c65c">☀</text>}
          {(g.mode==="shade"||g.mode==="nonogram") && g.name==="Minesweeper"&&hasShade &&
            <text x={x+SIZE/2} y={y+SIZE/2+8} textAnchor="middle" fontSize="24" fill="#f4c65c">✹</text>}
          {g.mode==="shade"&&locked&&clue!=="-"&&
            <text x={x+SIZE/2} y={y+SIZE/2+7} fill={clue==="x"?"#fff":"#3c4855"}
              fontSize={clue.length>2?12:19} textAnchor="middle" fontWeight="650">{clue==="o"?"○":clue==="x"?"■":clue}</text>}
          {g.mode==="slitherlink"&&clue!=="-"&&
            <text x={x+SIZE/2} y={y+SIZE/2+7} textAnchor="middle" fontSize="20" fill="#253447">{clue}</text>}
          {g.mode==="masyu"&&(clue==="b"||clue==="w")&&
            <circle cx={x+SIZE/2} cy={y+SIZE/2} r="10" fill={clue==="b"?"#273747":"#fff"} stroke="#263747" strokeWidth="2"/>}
          {g.mode==="number"&&!locked&&(s.notes[key]||[]).map((v,j)=><text key={j}
            x={x+4+(j%3)*12} y={y+10+Math.floor(j/3)*11} fontSize="9" fill="#748a9e">{v}</text>)}
          {p.regions&&<>
            {border("top")&&<line x1={x} y1={y} x2={x+SIZE} y2={y} stroke="#526274" strokeWidth="2.7"/>}
            {border("left")&&<line x1={x} y1={y} x2={x} y2={y+SIZE} stroke="#526274" strokeWidth="2.7"/>}
            {border("right")&&<line x1={x+SIZE} y1={y} x2={x+SIZE} y2={y+SIZE} stroke="#526274" strokeWidth="2.7"/>}
            {border("bottom")&&<line x1={x} y1={y+SIZE} x2={x+SIZE} y2={y+SIZE} stroke="#526274" strokeWidth="2.7"/>}
          </>}
          {sudokuBox&&<>
            {c%3===0&&<line x1={x} y1={y} x2={x} y2={y+SIZE} stroke="#49596b" strokeWidth="2.5"/>}
            {r%3===0&&<line x1={x} y1={y} x2={x+SIZE} y2={y} stroke="#49596b" strokeWidth="2.5"/>}
          </>}
        </g>;
      })}
      {g.mode==="slitherlink"&&Array.from({length:(p.rows+1)*(p.cols+1)},(_,i)=>{
        const r=Math.floor(i/(p.cols+1)),c=i%(p.cols+1);
        return <circle key={"d"+i} cx={x0+c*SIZE} cy={y0+r*SIZE} r="2.6" fill="#627486"/>;
      })}
      {(g.mode==="slitherlink"||g.mode==="masyu")&&edges.map((edge,i)=>{
        if(!marked.has(edge))return null;
        const parts=edge.split(":");
        const [r1,c1]=parts[1].split(",").map(Number),[r2,c2]=parts[2].split(",").map(Number);
        const atCenter=g.mode==="masyu"?SIZE/2:0;
        return <line key={edge} x1={x0+c1*SIZE+atCenter} y1={y0+r1*SIZE+atCenter}
          x2={x0+c2*SIZE+atCenter} y2={y0+r2*SIZE+atCenter} stroke="#287eae" strokeWidth="5.5" strokeLinecap="round"
          pointerEvents="none"/>;
      })}
    </svg>
  </div>;
}
