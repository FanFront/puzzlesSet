import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, CircleHelp, Download, Eraser, Grid3X3, Layers, Lightbulb, Pencil, Play, Redo2, RotateCcw, Search, Sparkles, Undo2, X } from "lucide-react";
import { Board } from "./Board";
import { GENRES, GENRE_MAP } from "./config";
import { answerVectors, blankSnapshot, cellKey, checkPuzzle, isLocked, parsePuzzle, readSaved, writeSaved } from "./game";
import type { Catalog, CatalogType, Genre, ParsedPuzzle, PuzzleRecord, Snapshot } from "./types";

type Active = { genre:Genre; record:PuzzleRecord; parsed:ParsedPuzzle };
const smallEnough = (p:ParsedPuzzle) => p.rows<=20 && p.cols<=20;
const pad = (n:number) => String(n).padStart(2,"0");
function App() {
  const [catalog,setCatalog]=useState<Catalog|null>(null);
  const [catalogError,setCatalogError]=useState("");
  const [loading,setLoading]=useState(false);
  const [search,setSearch]=useState("");
  const [filter,setFilter]=useState("All");
  const [active,setActive]=useState<Active|null>(null);
  const [snapshot,setSnapshot]=useState<Snapshot>(blankSnapshot());
  const [selection,setSelection]=useState<number[]>([]);
  const [multi,setMulti]=useState(false);
  const [pencil,setPencil]=useState(false);
  const [errors,setErrors]=useState<number[]>([]);
  const [message,setMessage]=useState("");
  const [hint,setHint]=useState(false);
  const [inputValue,setInputValue]=useState("");
  const cache=useRef(new Map<string,PuzzleRecord[]>());
  const timeline=useRef<{past:Snapshot[];future:Snapshot[]}>({past:[],future:[]});
  const request=useRef(0);

  useEffect(()=>{
    fetch("/puzzles/catalog.json").then(r=>{if(!r.ok)throw Error("Puzzle corpus not imported");return r.json();})
      .then((v:Catalog)=>setCatalog(v))
      .catch(e=>setCatalogError(String(e)));
  },[]);
  useEffect(()=>{
    if(active)writeSaved(active.genre.name,active.record.id,snapshot);
  },[active,snapshot]);

  const commit=useCallback((change:(current:Snapshot)=>Snapshot)=>{
    setSnapshot(current=>{
      const next=change(current);
      if(next===current || JSON.stringify(next)===JSON.stringify(current))return current;
      timeline.current.past.push(current);
      if(timeline.current.past.length>200)timeline.current.past.shift();
      timeline.current.future=[];
      setErrors([]);setMessage("");
      return next;
    });
  },[]);
  const undo=useCallback(()=>{
    setSnapshot(current=>{
      const prev=timeline.current.past.pop();
      if(!prev)return current;
      timeline.current.future.push(current);
      setErrors([]);setMessage("");
      return prev;
    });
  },[]);
  const redo=useCallback(()=>{
    setSnapshot(current=>{
      const next=timeline.current.future.pop();
      if(!next)return current;
      timeline.current.past.push(current);
      setErrors([]);setMessage("");
      return next;
    });
  },[]);
  const start=useCallback(async (genre:Genre)=>{
    if(!catalog)return;
    const entry=catalog.types.find(t=>t.name===genre.name);
    if(!entry || !entry.files.length){setMessage("No imported puzzles for "+genre.title);return;}
    const mine=++request.current;setLoading(true);setMessage("");
    try{
      const offset=Math.floor(Math.random()*entry.files.length);
      for(let attempt=0;attempt<entry.files.length;attempt++){
        const file=entry.files[(offset+attempt)%entry.files.length];
        let options=cache.current.get(file.path);
        if(!options){
          const response=await fetch("/puzzles/"+file.path);
          if(!response.ok)throw Error("Failed to load puzzle: "+file.path);
          const payload=await response.json();
          options=payload.puzzles as PuzzleRecord[];
          cache.current.set(file.path,options);
        }
        const playable=options.filter(v=>{
          if(!v.solution?.trim())return false;
          try{return smallEnough(parsePuzzle(v,genre));}catch{return false;}
        });
        if(!playable.length)continue;
        const choice=playable[Math.floor(Math.random()*playable.length)];
        if(mine!==request.current)return;
        const parsed=parsePuzzle(choice,genre);
        setActive({genre,record:choice,parsed});
        setSnapshot(readSaved(genre.name,choice.id));
        timeline.current={past:[],future:[]};
        setSelection([]);setMulti(false);setPencil(false);setHint(false);setErrors([]);setMessage("");
        return;
      }
      throw Error("No solved puzzles sized 20×20 or smaller found for "+genre.title);
    }catch(e){if(mine===request.current)setMessage(String(e));}
    finally{if(mine===request.current)setLoading(false);}
  },[catalog]);
  const back=()=>{request.current++;setActive(null);setErrors([]);setMessage("");setHint(false)};
  const selectCell=(index:number,extend:boolean)=>{
    setSelection(old=>extend?(old.includes(index)?old:[...old,index]):[index]);
  };
  const enter=(value:string)=>{
    if(!active)return;
    const {parsed:p,genre:g}=active;
    const indices=selection.filter(i=>!isLocked(p,g,Math.floor(i/p.cols),i%p.cols));
    if(!indices.length)return;
    commit(old=>{
      const marks={...old.marks},notes={...old.notes};
      for(const index of indices){
        const key=cellKey(Math.floor(index/p.cols),index%p.cols);
        if(pencil&&g.mode==="number"&&value!=="-"){
          const list=notes[key]||[];
          notes[key]=list.includes(value)?list.filter(v=>v!==value):[...list,value].sort((a,b)=>Number(a)-Number(b));
        }else{
          if(value==="-")delete marks[key];
          else marks[key]=value;
          if(g.mode==="number")delete notes[key];
        }
      }
      return {...old,marks,notes};
    });
  };
  const tap=(index:number)=>{
    if(!active)return;
    const {parsed:p,genre:g}=active;
    const r=Math.floor(index/p.cols),c=index%p.cols;
    if(isLocked(p,g,r,c))return;
    const key=cellKey(r,c);
    commit(old=>{
      const marks={...old.marks};
      if(marks[key]==="x")delete marks[key];
      else marks[key]="x";
      return {...old,marks};
    });
  };
  const edgeAction=(key:string,action:"toggle"|"paint")=>{
    commit(old=>{
      const current=new Set(old.edges);
      if(action==="paint")current.add(key);
      else if(current.has(key))current.delete(key);
      else current.add(key);
      return {...old,edges:[...current]};
    });
  };
  const check=async()=>{
    if(!active)return;
    const vectors=answerVectors(active.parsed,active.genre,snapshot);
    const result=await checkPuzzle(vectors.expected,vectors.actual);
    setErrors(active.genre.mode==="masyu"||active.genre.mode==="slitherlink" ? [] : result.mismatches);
    setMessage(result.correct?"Perfect! You solved this puzzle. 🎉":result.mismatches.length+" "+(vectors.edgeKeys?"line segments":"cells")+" do not match the stored answer. Keep going!");
    setHint(false);
  };
  const reset=()=>{
    if(!active||!window.confirm("Clear all your progress on this puzzle?"))return;
    commit(()=>blankSnapshot());setErrors([]);setMessage("");
  };
  useEffect(()=>{
    if(!active)return;
    const handler=(e:KeyboardEvent)=>{
      const target=e.target as HTMLElement;
      if(target instanceof HTMLInputElement||target instanceof HTMLTextAreaElement)return;
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();if(e.shiftKey)redo();else undo();return;}
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="y"){e.preventDefault();redo();return;}
      if(["Backspace","Delete"].includes(e.key)){e.preventDefault();enter("-");}
      else if(active.genre.mode==="number"&&/^[0-9]$/.test(e.key)){e.preventDefault();enter(e.key);}
      else if(active.genre.mode==="binary"&&["w","b"].includes(e.key.toLowerCase())){e.preventDefault();enter(e.key.toLowerCase());}
      else if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)&&selection.length){
        e.preventDefault();const idx=selection[selection.length-1],p=active.parsed;
        const r=Math.floor(idx/p.cols),c=idx%p.cols;
        const nr=Math.max(0,Math.min(p.rows-1,r+(e.key==="ArrowDown"?1:e.key==="ArrowUp"?-1:0)));
        const nc=Math.max(0,Math.min(p.cols-1,c+(e.key==="ArrowRight"?1:e.key==="ArrowLeft"?-1:0)));
        selectCell(nr*p.cols+nc,e.shiftKey);
      }
    };
    document.addEventListener("keydown",handler);
    return ()=>document.removeEventListener("keydown",handler);
  },[active,selection,pencil,undo,redo,enter]);
  const isLoop=active?.genre.mode==="masyu"||active?.genre.mode==="slitherlink";
  const genres=GENRES.filter(g=>{
    const entry=catalog?.types.find(t=>t.name===g.name);
    const match=(g.title+" "+g.description).toLowerCase().includes(search.toLowerCase());
    const family=g.mode==="number"?"Numbers":g.mode==="binary"?"Binary":g.mode==="masyu"||g.mode==="slitherlink"?"Loops":"Shading";
    return match&&(filter==="All"||filter===family)&&!!entry?.solved;
  });
  const sums={types:catalog?.types.length||0,puzzles:catalog?.types.reduce((n,t)=>n+t.count,0)||0,
    ready:catalog?.types.filter(t=>GENRE_MAP.has(t.name)&&t.solved>0).length||0};

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand" onClick={back} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==="Enter")back()}}>
        <span className="brand-mark"><Grid3X3 size={21}/></span>
        <span>puzzles<span className="brand-accent">Set</span></span>
      </div>
      <div className="topbar-right"><span className="offline-dot"/> OFFLINE FIRST</div>
    </header>
    {!active?<main className="home">
      <section className="hero">
        <div className="eyebrow"><Sparkles size={15}/> YOUR DAILY DOSE OF LOGIC</div>
        <h1>A world of puzzles.<br/><em>One place to play.</em></h1>
        <p>Explore brain-teasing challenges from the PuzzleKit collection. No account, no internet, no pressure — just you and the grid.</p>
        <div className="stats">
          <div><strong>{sums.puzzles.toLocaleString()}</strong><span>puzzles imported</span></div>
          <div><strong>{sums.ready}</strong><span>playable types</span></div>
          <div><strong>100%</strong><span>offline play</span></div>
        </div>
      </section>
      <section className="library">
        <div className="section-heading"><div><div className="eyebrow dark">THE COLLECTION</div><h2>Pick your challenge</h2></div><span className="section-count">{sums.ready} games</span></div>
        <div className="search-box"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find a puzzle type..." aria-label="Search puzzle types"/>{search&&<button onClick={()=>setSearch("")}><X size={18}/></button>}</div>
        <div className="filters">{["All","Numbers","Shading","Binary","Loops"].map(x=><button key={x} onClick={()=>setFilter(x)} className={x===filter?"active":""}>{x}</button>)}</div>
        {catalogError && <div className="notice">No puzzle data found. Run <code>npm run data:sync</code> before starting the app, then reload. {catalogError}</div>}
        {message && <div className="notice">{message}</div>}
        {loading&&<div className="notice">Opening puzzle…</div>}
        <div className="game-list">
          {genres.map(g=>{
            const entry=catalog?.types.find(t=>t.name===g.name);
            return <button disabled={loading} className="game-card" key={g.name} onClick={()=>start(g)}>
              <div className="game-icon">{g.symbol}</div><div className="game-copy"><strong>{g.title}</strong><span>{g.description}</span><small>{(entry?.solved||0).toLocaleString()} solved puzzles available</small></div>
              <span className="play-arrow"><ChevronRight size={22}/></span>
            </button>;
          })}
        </div>
        {catalog&&!genres.length&&<div className="empty-state">No matching games in this import. Try another filter.</div>}
      </section>
      <footer className="footer">Built with Tauri + Rust · Puzzle data: SmilingWayne/puzzlekit-dataset · Game progress stays on your device.</footer>
    </main>:<main className="playing">
      <div className="play-heading">
        <button className="circle-button" aria-label="Back to collection" onClick={back}><ChevronLeft size={22}/></button>
        <div className="puzzle-info"><span className="eyebrow dark">NOW PLAYING</span><h2>{active.genre.title}</h2><small>{active.parsed.rows} × {active.parsed.cols} · {active.record.id}</small></div>
        <button className="circle-button" onClick={()=>start(active.genre)} title="New puzzle"><RotateCcw size={19}/></button>
      </div>
      <div className="board-area"><Board parsed={active.parsed} genre={active.genre} state={snapshot} selected={selection} errors={errors}
        multi={multi} onSelect={selectCell} onTap={tap} onEdge={edgeAction}/></div>
      <div className="toolbar">
        <button className="tool" onClick={undo} disabled={!timeline.current.past.length}><Undo2 size={19}/><span>Undo</span></button>
        <button className="tool" onClick={redo} disabled={!timeline.current.future.length}><Redo2 size={19}/><span>Redo</span></button>
        <button className={"tool "+(multi?"tool-active":"")} onClick={()=>setMulti(x=>!x)} title="Select multiple cells"><Layers size={19}/><span>Multi</span></button>
        {active.genre.mode==="number"&&<button className={"tool "+(pencil?"tool-active":"")} onClick={()=>setPencil(x=>!x)} title="Pencil notes / superscript numbers"><Pencil size={19}/><span>Notes</span></button>}
        <button className="tool" onClick={reset}><RotateCcw size={19}/><span>Reset</span></button>
      </div>
      {active.genre.mode==="number"&&<div className="keypad">
        {Array.from({length:Math.min(9,Math.max(active.parsed.rows,active.parsed.cols))},(_,i)=>i+1).map(n=><button className="key" key={n} onClick={()=>enter(String(n))}>{n}</button>)}
        <div className="wide-entry"><input inputMode="numeric" aria-label="Enter any number" placeholder="Number…" value={inputValue} onChange={e=>setInputValue(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){enter(inputValue);setInputValue("");}}}/><button onClick={()=>{if(/^\d+$/.test(inputValue)){enter(inputValue);setInputValue("");}}}>Enter</button></div>
        <button className="erase" onClick={()=>enter("-")}><Eraser size={17}/> Erase</button>
      </div>}
      {active.genre.mode==="binary"&&<div className="choice-row"><button onClick={()=>enter("b")}>● Black</button><button onClick={()=>enter("w")}>○ White</button><button onClick={()=>enter("-")}><Eraser size={17}/> Erase</button></div>}
      {(active.genre.mode==="shade"||active.genre.mode==="nonogram")&&<div className="choice-row"><button onClick={()=>enter("x")}>■ {active.genre.name==="Starbattle"?"Star":active.genre.name==="Akari"?"Bulb":"Fill selected"}</button><button onClick={()=>enter("-")}>□ Erase selected</button></div>}
      {isLoop&&<p className="control-tip">{active.genre.mode==="masyu"?"Drag between adjacent cell centers to draw a loop; tap existing paths to remove with undo.":"Tap grid edges to toggle, or drag along the edges to draw a loop."}</p>}
      {active.genre.mode==="number"&&<p className="control-tip">Tap a cell to select it. Toggle <b>Multi</b> to select several cells, or drag across a group. Toggle <b>Notes</b> for tiny superscript candidates. Keyboard shortcuts: Ctrl+Z / Ctrl+Y.</p>}
      {message&&<div role="status" className={"result "+(message.startsWith("Perfect")?"win":"")}>{message}</div>}
      <div className="play-actions">
        <button className="check-button" onClick={check}><CheckCircle2 size={21}/> Check answer</button>
        <button className="secondary-button" onClick={()=>setHint(v=>!v)}><CircleHelp size={19}/> Rules</button>
      </div>
      {hint&&<div className="rules-note">Follow the usual {active.genre.title} rules to solve the grid. <b>Check answer</b> compares your current entries with the stored solution; it does not give a hint or run a solver. Undo and redo keep the full edit history for this session.</div>}
      <p className="save-note">Progress saves automatically on this device.</p>
    </main>}
  </div>;
}
export default App;
