import type { Check, Genre, ParsedPuzzle, PuzzleRecord, Snapshot } from "./types";
import { invoke, isTauri } from "@tauri-apps/api/core";

const lines = (text: string) => text.trim().split(/\r?\n/).map(s=>s.trim().split(/\s+/));
const padded = (line: string[] | undefined, columns: number) =>
  Array.from({length: columns},(_,i)=>line?.[i] || "-");

export function parsePuzzle(record: PuzzleRecord, genre: Genre): ParsedPuzzle {
  const problem = lines(record.problem), solution = lines(record.solution);
  const rows = Number(problem[0]?.[0]), cols = Number(problem[0]?.[1]);
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1 || rows > 120 || cols > 120)
    throw new Error("Invalid puzzle dimensions");
  if (solution.length < rows+1) throw new Error("Puzzle has no complete answer");
  const answer = Array.from({length:rows},(_,r)=>padded(solution[1+r],cols));
  if (genre.mode === "nonogram") {
    if (problem.length < 1+rows+cols) throw new Error("Nonogram is missing its margin clues");
    const rowClues = problem.slice(1,1+rows).map(r=>r.filter(x=>x!=="-"));
    const colClues = problem.slice(1+rows,1+rows+cols).map(r=>r.filter(x=>x!=="-"));
    return {rows,cols,answer,clues:Array.from({length:rows},()=>padded([],cols)),rowClues,colClues};
  }
  const body = problem.slice(1);
  if (body.length < rows) throw new Error("Missing grid rows");
  const clues = genre.regionOnly ? Array.from({length:rows},()=>padded([],cols))
                                  : Array.from({length:rows},(_,r)=>padded(body[r],cols));
  const regionStart = genre.regionOnly ? 0 : rows;
  const regions = body.length >= regionStart+rows && (genre.regionOnly || body.length >= rows*2)
    ? Array.from({length:rows},(_,r)=>padded(body[regionStart+r],cols))
    : undefined;
  return {rows,cols,clues,answer,regions};
}
export function cellKey(r:number,c:number): string {return String(r)+","+String(c);}
export function cellEdge(r:number,c:number,s:number,d:number): string {
  const a=cellKey(r,c), b=cellKey(s,d);
  return r<s || (r===s && c<d) ? "C:"+a+":"+b : "C:"+b+":"+a;
}
export function vertexEdge(r:number,c:number,s:number,d:number): string {
  const a=cellKey(r,c), b=cellKey(s,d);
  return r<s || (r===s && c<d) ? "V:"+a+":"+b : "V:"+b+":"+a;
}
export function allEdges(p:ParsedPuzzle, genre:Genre): string[] {
  const list:string[]=[];
  if(genre.mode==="masyu"){
    for(let r=0;r<p.rows;r++) for(let c=0;c<p.cols;c++){
      if(c+1<p.cols) list.push(cellEdge(r,c,r,c+1));
      if(r+1<p.rows) list.push(cellEdge(r,c,r+1,c));
    }
  } else if(genre.mode==="slitherlink"){
    for(let r=0;r<=p.rows;r++) for(let c=0;c<=p.cols;c++){
      if(c<p.cols) list.push(vertexEdge(r,c,r,c+1));
      if(r<p.rows) list.push(vertexEdge(r,c,r+1,c));
    }
  }
  return list;
}
export function solutionEdges(p:ParsedPuzzle,genre:Genre): Set<string> {
  const edges=new Set<string>();
  if(genre.mode==="masyu"){
    for(let r=0;r<p.rows;r++) for(let c=0;c<p.cols;c++){
      const value=p.answer[r][c].toLowerCase();
      if(value.includes("e") && c+1<p.cols)edges.add(cellEdge(r,c,r,c+1));
      if(value.includes("s") && r+1<p.rows)edges.add(cellEdge(r,c,r+1,c));
    }
  } else if(genre.mode==="slitherlink"){
    const filled=(r:number,c:number)=>r>=0&&r<p.rows&&c>=0&&c<p.cols&&p.answer[r][c]==="x";
    for(let r=0;r<p.rows;r++)for(let c=0;c<p.cols;c++)if(filled(r,c)){
      if(!filled(r-1,c))edges.add(vertexEdge(r,c,r,c+1));
      if(!filled(r+1,c))edges.add(vertexEdge(r+1,c,r+1,c+1));
      if(!filled(r,c-1))edges.add(vertexEdge(r,c,r+1,c));
      if(!filled(r,c+1))edges.add(vertexEdge(r,c+1,r+1,c+1));
    }
  }
  return edges;
}
export function isLocked(p:ParsedPuzzle,genre:Genre,r:number,c:number):boolean {
  return !genre.clueOnly && !genre.regionOnly && genre.mode!=="nonogram" &&
    genre.mode!=="masyu" && genre.mode!=="slitherlink" && p.clues[r][c]!=="-";
}
export function isMarked(solutionToken:string,genre:Genre):boolean {
  if(genre.name==="LITS")return ["L","I","T","S","x"].includes(solutionToken);
  if(genre.name==="Akari")return solutionToken==="o";
  return solutionToken==="x";
}
export function answerVectors(p:ParsedPuzzle,genre:Genre,s:Snapshot): {expected:string[];actual:string[];edgeKeys?:string[]} {
  const expected:string[]=[], actual:string[]=[];
  if(genre.mode==="masyu"||genre.mode==="slitherlink"){
    const keys=allEdges(p,genre), wanted=solutionEdges(p,genre), marked=new Set(s.edges);
    for(const key of keys){ expected.push(wanted.has(key)?"1":"0"); actual.push(marked.has(key)?"1":"0"); }
    return {expected,actual,edgeKeys:keys};
  }
  for(let r=0;r<p.rows;r++)for(let c=0;c<p.cols;c++){
    const key=cellKey(r,c), given=p.clues[r][c], token=p.answer[r][c];
    if(genre.mode==="shade"||genre.mode==="nonogram"){
      expected.push(isMarked(token,genre)?"1":"0");
      actual.push(isLocked(p,genre,r,c) ? (isMarked(token,genre)?"1":"0") : s.marks[key]==="x"?"1":"0");
    }else{
      expected.push(token);
      actual.push(isLocked(p,genre,r,c)?given:(s.marks[key]||"-"));
    }
  }
  return {expected,actual};
}
export async function checkPuzzle(expected:string[],actual:string[]):Promise<Check>{
  if(isTauri()){
    try{return await invoke<Check>("check_answer",{expected,actual});}
    catch(err){console.warn("Native checker unavailable, using browser fallback",err);}
  }
  const mismatches:number[]=[];
  for(let i=0;i<Math.max(expected.length,actual.length);i++) if(expected[i]!==actual[i])mismatches.push(i);
  return {correct:mismatches.length===0,mismatches,total:Math.max(expected.length,actual.length)};
}
export const blankSnapshot=():Snapshot=>({marks:{},notes:{},edges:[]});
export function readSaved(name:string,id:string):Snapshot{
  try {
    const raw=localStorage.getItem("puzzlesSet:state:"+name+":"+id);
    if(!raw)return blankSnapshot();
    const v=JSON.parse(raw);
    return {marks:typeof v.marks==="object"&&v.marks&&!Array.isArray(v.marks)?v.marks:{},
      notes:typeof v.notes==="object"&&v.notes&&!Array.isArray(v.notes)?v.notes:{},
      edges:Array.isArray(v.edges)?v.edges.filter((x:unknown)=>typeof x==="string"):[]};
  }catch{return blankSnapshot();}
}
export function writeSaved(name:string,id:string,s:Snapshot):void {
  try{localStorage.setItem("puzzlesSet:state:"+name+":"+id,JSON.stringify(s));}catch{ /* storage may be unavailable */ }
}
