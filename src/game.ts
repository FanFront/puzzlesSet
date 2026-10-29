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
/** Parse the dimensions in an original upstream key, e.g. 20_12x12.
 * No separate size/classification index is generated during import or CI. */
export function gridSizeFromRecord(record:PuzzleRecord):string {
  const match=record.id.match(/(?:^|_)(\d+)x(\d+)(?:_|$)/i);
  if(match)return Number(match[1])+"x"+Number(match[2]);
  const header=record.problem.trim().split(/\s+/,2);
  return header.length===2&&header.every(v=>/^\d+$/.test(v))?header[0]+"x"+header[1]:"";
}
/** Select controls from the actual answer encoding for unlisted puzzle types. */
export function adaptGenre(record:PuzzleRecord,genre:Genre):Genre {
  if(!genre.adaptive)return genre;
  const answer=lines(record.solution);
  const rows=Number(answer[0]?.[0]),cols=Number(answer[0]?.[1]);
  const tokens=answer.slice(1,1+rows).flat().filter(v=>v!=="-");
  if(!tokens.length||!Number.isInteger(rows)||!Number.isInteger(cols))return genre;
  let mode:Genre["mode"]="symbols";
  if(tokens.every(v=>v==="x"))mode="shade";
  else if(tokens.includes("x") && tokens.some(v=>/^[nsew]+$/.test(v))
          && tokens.every(v=>v==="x"||/^[nsew]+$/.test(v)))mode="mixed";
  else if(tokens.every(v=>v==="b"||v==="w"))mode="binary";
  else if(!["Shakashaka","Battleship","DigitalBattleship"].includes(genre.name)
          &&tokens.every(v=>/^[nsew]+$/.test(v)))mode="masyu";
  else if(tokens.every(v=>/^\d+$/.test(v)))mode="number";
  return {...genre,mode};
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
  if((genre.mode==="masyu"||genre.mode==="mixed")){
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
  if((genre.mode==="masyu"||genre.mode==="mixed")){
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
  const clue=p.clues[r][c];
  if(genre.name==="Hitori"||genre.name==="Mosaic")return false;
  if(genre.adaptive){
    if(clue==="-"||clue==="."||clue==="?")return false;
    if(genre.mode==="mixed")return true;
    if(genre.mode==="shade")return clue==="x"||clue==="o"||/^\d+$/.test(clue);
    if(genre.mode==="masyu"||genre.mode==="slitherlink")return false;
    // Numeric givens match the answer; other tokens are constraint labels,
    // displayed separately instead of accidentally blocking player input.
    return clue===p.answer[r][c];
  }
  return !genre.clueOnly && !genre.regionOnly && genre.mode!=="nonogram" &&
    genre.mode!=="masyu" && genre.mode!=="slitherlink" && clue!=="-";
}
export function isMarked(solutionToken:string,genre:Genre):boolean {
  if(genre.name==="LITS")return ["L","I","T","S","x"].includes(solutionToken);
  if(genre.name==="Akari")return solutionToken==="o";
  return solutionToken==="x";
}
/** Only player-entered answers are sent to the checker. Clues, blanks, and notes are excluded. */
export function answerVectors(p:ParsedPuzzle,genre:Genre,s:Snapshot): {expected:string[];actual:string[];complete:boolean} {
  const expected:string[]=[],actual:string[]=[];
  if((genre.mode==="masyu"||genre.mode==="mixed")||genre.mode==="slitherlink"){
    const keys=new Set(allEdges(p,genre));
    const wanted=solutionEdges(p,genre);
    const entered=new Set(s.edges.filter(key=>keys.has(key)));
    for(const key of entered){expected.push(wanted.has(key)?"1":"0");actual.push("1");}
    let complete=entered.size===wanted.size&&[...wanted].every(key=>entered.has(key));
    if(genre.mode==="mixed"){
      for(let r=0;r<p.rows;r++)for(let c=0;c<p.cols;c++){
        if(isLocked(p,genre,r,c))continue;
        const mark=s.marks[cellKey(r,c)];
        if(p.answer[r][c]==="x"&&mark!=="x")complete=false;
        if(mark==="x"||mark==="w"){
          expected.push(p.answer[r][c]==="x"?"1":"0");
          actual.push(mark==="x"?"1":"0");
        }
      }
    }
    return {expected,actual,complete};
  }
  let complete=true;
  for(let r=0;r<p.rows;r++)for(let c=0;c<p.cols;c++){
    if(isLocked(p,genre,r,c))continue;
    const mark=s.marks[cellKey(r,c)];
    if(mark===undefined||mark==="-"){complete=false;continue;}
    const token=p.answer[r][c];
    if(genre.mode==="shade"||genre.mode==="nonogram"){
      if(mark!=="x"&&mark!=="w"){complete=false;continue;}
      expected.push(isMarked(token,genre)?"1":"0");
      actual.push(mark==="x"?"1":"0");
    }else{
      expected.push(token);
      actual.push(mark==="~"?"-":mark);
    }
  }
  return {expected,actual,complete};
}
/** Rust and web use the same result contract; mismatched positions never leave the checker. */
export async function checkPuzzle(expected:string[],actual:string[]):Promise<Check>{
  if(isTauri()){
    try{return await invoke<Check>("check_answer",{expected,actual});}
    catch(err){console.warn("Native checker unavailable, using browser fallback",err);}
  }
  return {hasWrong:expected.length!==actual.length||expected.some((v,i)=>v!==actual[i]),checked:actual.length};
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
