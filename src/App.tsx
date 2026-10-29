import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, CircleHelp, Eraser, Grid3X3, Layers, Pencil, Play, Redo2, RotateCcw, Search, Sparkles, Undo2, X } from "lucide-react";
import { Board } from "./Board";
import { genreFor } from "./config";
import { localizedDescription, localizedRules, localizedTitle } from "./rules";
import { adaptGenre, answerVectors, blankSnapshot, cellKey, checkPuzzle, gridSizeFromRecord, isLocked, parsePuzzle, readSaved, writeSaved } from "./game";
import type { Catalog, CatalogType, Genre, Language, ParsedPuzzle, PuzzleRecord, Snapshot } from "./types";

type Active = { genre: Genre; record: PuzzleRecord; parsed: ParsedPuzzle; level: number };
type Screen = "library" | "levels" | "game";
const PAGE_SIZE = 36;
const dictionary = {
  zh: {
    offline:"离线畅玩", heroTag:"一座随身携带的解谜乐园", heroTitle:"今天，来解一道题。", heroText:"探索多种逻辑谜题 · 自由选关 · 自动保存进度。跟随自己的节奏，享受推理的乐趣。",
    count:"收录谜题", types:"可玩类型", private:"无需联网", library:"游戏大厅", choose:"挑选喜欢的玩法", search:"搜索游戏类型…", all:"全部", number:"数字", shade:"涂色", binary:"黑白", loop:"画线",
    available:"关可选", solved:"已完成", levelTitle:"选择关卡", selectPrompt:"选择一个关卡开始解谜。你的进度会保存在本机。", level:"第", levelSuffix:"关", board:"游戏棋盘",
    howTo:"玩法说明", rulesTitle:"游戏规则", gotIt:"开始玩", next:"下一关", previous:"上一关", back:"返回", play:"进入关卡",
    undo:"撤销", redo:"重做", multi:"多选", notes:"笔记", reset:"重置", clear:"清除", fill:"涂黑", empty:"标空", star:"星星", bulb:"灯泡", black:"黑", white:"白",
    markEmpty:"留空", enter:"输入", numberPlaceholder:"输入数字", check:"检查填写", help:"规则", pause:"保存中", saved:"进度自动保存在此设备", given:"初始提示", yours:"你的填写", legends:"棋盘图例",
    notYet:"还没有填写内容。先试试吧！", wrong:"有填写错误，请再检查一下。", good:"目前填写的内容没有错误，继续加油！", won:"恭喜完成本关！🎉", failed:"无法打开该关卡，请选择另一关。", notPlayable:"这道谜题没有可检查的完整答案，当前暂不可玩。",
    resetConfirm:"确定要清空这一关的所有填写吗？", noData:"未找到离线题库，请先导入谜题数据。", noMatch:"没有匹配的游戏类型。", load:"正在打开关卡…",
    levelHint:"按编号选关，绝不随机跳转", sizeAll:"全部尺寸", sizeTitle:"棋盘尺寸", filtered:"符合条件的关卡", unavailable:"暂不可玩", more:"查看更多关卡", backLevels:"返回选关", tipNumber:"点击选中格子，再使用数字键盘。笔记模式可添加角标候选数；多选支持拖动选择。", tipShade:"点击格子可快速涂黑，或使用下方按钮标记白格。初始线索无法修改。", tipLoop:"沿线条滑动绘制闭环；可用撤销与重做修改路径。", tipBinary:"点选方格后填写黑或白；初始圆点不可更改。",
    loadError:"无法加载题库", levelsEmpty:"此类型暂无可用关卡。", rulesFallback:"此玩法尚无已核实的详细规则说明。请参考原题来源；可以使用棋盘进行填写和检查。", source:"原题来源"
  },
  en: {
    offline:"PLAY OFFLINE",heroTag:"YOUR POCKET PUZZLE ARCADE",heroTitle:"A little logic. A lot of fun.",heroText:"Many puzzle styles · choose your level · progress saved automatically. Play at your own pace.",
    count:"puzzles",types:"playable games",private:"offline",library:"GAME LIBRARY",choose:"Choose your next challenge",search:"Search puzzle types…",all:"All",number:"Numbers",shade:"Shading",binary:"Binary",loop:"Loops",
    available:"levels",solved:"completed",levelTitle:"Choose a level",selectPrompt:"Pick any numbered level. Your progress stays on this device.",level:"Level ",levelSuffix:"",board:"Puzzle board",
    howTo:"How to play",rulesTitle:"How to play",gotIt:"Let's play",next:"Next level",previous:"Previous level",back:"Back",play:"Play level",
    undo:"Undo",redo:"Redo",multi:"Multi",notes:"Notes",reset:"Reset",clear:"Erase",fill:"Fill",empty:"Mark empty",star:"Star",bulb:"Bulb",black:"Black",white:"White",
    markEmpty:"Empty",enter:"Enter",numberPlaceholder:"Number",check:"Check entries",help:"Rules",pause:"Saving",saved:"Progress is saved automatically on this device",given:"Given clue",yours:"Your entry",legends:"Board key",
    notYet:"Nothing entered yet. Give it a try!",wrong:"Some of your entries are incorrect. Have another look.",good:"No mistakes in your entries so far. Keep going!",won:"Puzzle completed! 🎉",failed:"Unable to open this level. Please choose another.",notPlayable:"This level has no checkable solution, so it is not playable yet.",
    resetConfirm:"Clear all of your entries for this level?",noData:"Offline puzzle data was not found. Import the data before running the app.",noMatch:"No matching games found.",load:"Opening level…",
    levelHint:"Choose by number — never random",sizeAll:"All sizes",sizeTitle:"Grid size",filtered:"matching levels",unavailable:"Not playable yet",more:"Browse more levels",backLevels:"All levels",tipNumber:"Tap to select cells, then use the number pad. Notes are small candidates; Multi supports drag selection.",tipShade:"Tap to fill quickly, or mark cells as empty using the controls. Initial clues are fixed.",tipLoop:"Drag to draw a loop. Undo and redo edit your paths.",tipBinary:"Select a cell, then choose black or white. Initial circles cannot be changed.",
    loadError:"Unable to load library",levelsEmpty:"No levels available in this category.",rulesFallback:"Verified rules for this variant are not documented yet. Consult the original puzzle source; you can still enter and check answers on the board.",source:"Original puzzle"
  }
} as const;

function savedLanguage(): Language {
  try { return localStorage.getItem("puzzlesSet:language")==="en"?"en":"zh"; } catch { return "zh"; }
}
function completedLevels(): Record<string,boolean> {
  const result: Record<string,boolean>={};
  try {
    for(let i=0;i<localStorage.length;i++) {
      const key=localStorage.key(i);
      if(key?.startsWith("puzzlesSet:won:")) result[key.slice("puzzlesSet:won:".length)]=true;
    }
  } catch { /* private browsing */ }
  return result;
}
function totalLevels(entry: CatalogType | undefined): number {
  return entry?.files.reduce((sum,file)=>sum+file.count,0)||0;
}
function gameFamily(g: Genre): "number"|"shade"|"binary"|"loop" {
  if(g.mode==="number"||g.mode==="symbols")return "number";
  if(g.mode==="binary")return "binary";
  if(g.mode==="masyu"||g.mode==="slitherlink")return "loop";
  return "shade";
}
function App() {
  const [language,setLanguage]=useState<Language>(savedLanguage);
  const t=dictionary[language];
  const [screen,setScreen]=useState<Screen>("library");
  const [catalog,setCatalog]=useState<Catalog|null>(null);
  const [catalogError,setCatalogError]=useState("");
  const [loading,setLoading]=useState(false);
  const [search,setSearch]=useState("");
  const [filter,setFilter]=useState("all");
  const [chosen,setChosen]=useState<Genre|null>(null);
  const [page,setPage]=useState(0);
  const [sizeFilter,setSizeFilter]=useState("all");
  const [indexedLevels,setIndexedLevels]=useState<{index:number;id:string;size:string;ready:boolean}[]>([]);
  const [indexing,setIndexing]=useState(false);
  const [active,setActive]=useState<Active|null>(null);
  const [snapshot,setSnapshot]=useState<Snapshot>(blankSnapshot());
  const [selection,setSelection]=useState<number[]>([]);
  const [multi,setMulti]=useState(false);
  const [pencil,setPencil]=useState(false);
  const [message,setMessage]=useState("");
  const [resultKind,setResultKind]=useState<"good"|"wrong"|"won"|"">("");
  const [rulesOpen,setRulesOpen]=useState(false);
  const [inputValue,setInputValue]=useState("");
  const [done,setDone]=useState<Record<string,boolean>>(completedLevels);
  const cache=useRef(new Map<string,PuzzleRecord[]>());
  const timeline=useRef<{past:Snapshot[];future:Snapshot[]}>({past:[],future:[]});
  const request=useRef(0);
  const checkVersion=useRef(0);

  useEffect(()=>{
    fetch("/puzzles/catalog.json").then(r=>{if(!r.ok)throw Error("Puzzle corpus not imported");return r.json();})
      .then((v:Catalog)=>setCatalog(v))
      .catch(e=>setCatalogError(String(e)));
  },[]);
  useEffect(()=>{try{localStorage.setItem("puzzlesSet:language",language);}catch{/* storage optional */}},[language]);
  useEffect(()=>{if(active)writeSaved(active.genre.name,active.record.id,snapshot);},[active,snapshot]);
  useEffect(()=>{
    if(!rulesOpen)return;
    const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape")setRulesOpen(false);};
    document.addEventListener("keydown",onKey);
    return ()=>document.removeEventListener("keydown",onKey);
  },[rulesOpen]);

  const commit=useCallback((change:(current:Snapshot)=>Snapshot)=>{
    checkVersion.current++;setResultKind("");setMessage("");
    setSnapshot(current=>{
      const next=change(current);
      if(next===current||JSON.stringify(next)===JSON.stringify(current))return current;
      timeline.current.past.push(current);
      if(timeline.current.past.length>200)timeline.current.past.shift();
      timeline.current.future=[];
      return next;
    });
  },[]);
  const undo=useCallback(()=>{
    checkVersion.current++;setMessage("");setResultKind("");
    setSnapshot(current=>{
      const prev=timeline.current.past.pop();
      if(!prev)return current;
      timeline.current.future.push(current);
      return prev;
    });
  },[]);
  const redo=useCallback(()=>{
    checkVersion.current++;setMessage("");setResultKind("");
    setSnapshot(current=>{
      const next=timeline.current.future.pop();
      if(!next)return current;
      timeline.current.past.push(current);
      return next;
    });
  },[]);
  // Read original IDs only when a series is chosen. The dataset and CI
  // never create an extra size-classification file.
  useEffect(()=>{
    if(!chosen||!catalog)return;
    const entry=catalog.types.find(v=>v.name===chosen.name);
    let cancelled=false;
    setIndexedLevels([]);
    setIndexing(true);
    (async()=>{
      const result:{index:number;id:string;size:string;ready:boolean}[]=[];
      let offset=0;
      for(const file of entry?.files||[]){
        if(cancelled)return;
        let records=cache.current.get(file.path);
        if(!records){
          const response=await fetch("/puzzles/"+file.path);
          if(!response.ok)throw Error("Failed to load "+file.path);
          const payload=await response.json();
          if(!Array.isArray(payload.puzzles))throw Error("Malformed puzzle shard");
          records=payload.puzzles as PuzzleRecord[];
          cache.current.set(file.path,records);
        }
        for(let i=0;i<file.count;i++){
          const record=records[i];
          result.push({index:offset+i,id:record?.id||String(offset+i+1),
            size:record?gridSizeFromRecord(record):"",ready:!!record?.solution?.trim()});
        }
        offset+=file.count;
      }
      if(!cancelled)setIndexedLevels(result);
    })().catch(e=>{if(!cancelled)setMessage(e instanceof Error?e.message:String(e));})
      .finally(()=>{if(!cancelled)setIndexing(false);});
    return ()=>{cancelled=true;};
  },[chosen?.name,catalog]);

  const openLevels=(genre:Genre)=>{
    request.current++;checkVersion.current++;
    if(chosen?.name!==genre.name){setSizeFilter("all");setPage(0);}
    setChosen(genre);setActive(null);
    setScreen("levels");
    setMessage("");setResultKind("");setRulesOpen(false);
  };
  const back=()=>{
    if(screen==="game"&&active){openLevels(active.genre);return;}
    request.current++;checkVersion.current++;
    setScreen("library");setChosen(null);setActive(null);setMessage("");setRulesOpen(false);
  };
  const loadLevel=useCallback(async (genre:Genre,level:number)=>{
    const entry=catalog?.types.find(v=>v.name===genre.name);
    if(!entry||level<0||level>=totalLevels(entry))return;
    const mine=++request.current;checkVersion.current++;
    setLoading(true);setMessage("");setResultKind("");
    try{
      let offset=level;
      const file=entry.files.find(f=>{if(offset<f.count)return true;offset-=f.count;return false;});
      if(!file)throw Error("Missing puzzle shard");
      let records=cache.current.get(file.path);
      if(!records){
        const response=await fetch("/puzzles/"+file.path);
        if(!response.ok)throw Error("Failed to load "+file.path);
        const payload=await response.json();
        if(!Array.isArray(payload.puzzles))throw Error("Malformed puzzle shard");
        records=payload.puzzles as PuzzleRecord[];
        cache.current.set(file.path,records);
      }
      const record=records[offset];
      if(!record?.solution?.trim())throw Error(t.notPlayable);
      const playableGenre=adaptGenre(record,genre);
      const parsed=parsePuzzle(record,playableGenre);
      if(mine!==request.current)return;
      setActive({genre:playableGenre,record,parsed,level});
      setChosen(genre);
      setSnapshot(readSaved(genre.name,record.id));
      timeline.current={past:[],future:[]};
      setSelection([]);setMulti(false);setPencil(false);setInputValue("");
      setMessage("");setRulesOpen(false);setScreen("game");
    }catch(e){if(mine===request.current)setMessage(e instanceof Error?e.message:t.failed);}
    finally{if(mine===request.current)setLoading(false);}
  },[catalog,language]);

  const selectCell=(index:number,extend:boolean)=>setSelection(old=>extend?(old.includes(index)?old:[...old,index]):[index]);
  const enter=(value:string)=>{
    if(!active)return;
    const {parsed:p,genre:g}=active;
    const indices=selection.filter(i=>!isLocked(p,g,Math.floor(i/p.cols),i%p.cols));
    if(!indices.length)return;
    commit(old=>{
      const marks={...old.marks},notes={...old.notes};
      for(const index of indices){
        const key=cellKey(Math.floor(index/p.cols),index%p.cols);
        if(pencil&&g.mode==="number"&&value!=="-"&&value!=="~"){
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
    const p=active.parsed,g=active.genre;
    if(isLocked(p,g,Math.floor(index/p.cols),index%p.cols))return;
    const key=cellKey(Math.floor(index/p.cols),index%p.cols);
    commit(old=>{
      const marks={...old.marks};
      if(marks[key]==="x")delete marks[key];else marks[key]="x";
      return {...old,marks};
    });
  };
  const edgeAction=(key:string,action:"toggle"|"paint")=>{
    commit(old=>{
      const edges=new Set(old.edges);
      if(action==="paint")edges.add(key);
      else if(edges.has(key))edges.delete(key);
      else edges.add(key);
      return {...old,edges:[...edges]};
    });
  };
  const check=async()=>{
    if(!active)return;
    const v=answerVectors(active.parsed,active.genre,snapshot);
    const stamp=++checkVersion.current;
    const result=await checkPuzzle(v.expected,v.actual);
    if(stamp!==checkVersion.current)return;
    if(result.checked===0){
      setResultKind("");setMessage(t.notYet);
    }else if(result.hasWrong){
      setResultKind("wrong");setMessage(t.wrong);
    }else if(v.complete){
      setResultKind("won");setMessage(t.won);
      const key=active.genre.name+":"+active.level;
      setDone(old=>({...old,[key]:true}));
      try{localStorage.setItem("puzzlesSet:won:"+key,"1");}catch{/* storage optional */}
    }else{
      setResultKind("good");setMessage(t.good);
    }
  };
  const reset=()=>{
    if(!active||!window.confirm(t.resetConfirm))return;
    commit(()=>blankSnapshot());setSelection([]);
  };
  useEffect(()=>{
    if(!active||screen!=="game"||rulesOpen)return;
    const handler=(e:KeyboardEvent)=>{
      const target=e.target as HTMLElement;
      if(target instanceof HTMLInputElement||target instanceof HTMLTextAreaElement)return;
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();if(e.shiftKey)redo();else undo();return;}
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="y"){e.preventDefault();redo();return;}
      if(["Backspace","Delete"].includes(e.key)){e.preventDefault();enter("-");}
      else if(active.genre.mode==="number"&&/^[0-9]$/.test(e.key)){e.preventDefault();enter(e.key);}
      else if(active.genre.mode==="binary"&&["w","b"].includes(e.key.toLowerCase())){e.preventDefault();enter(e.key.toLowerCase());}
      else if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)&&selection.length){
        e.preventDefault();
        const idx=selection[selection.length-1],p=active.parsed,r=Math.floor(idx/p.cols),c=idx%p.cols;
        const nr=Math.max(0,Math.min(p.rows-1,r+(e.key==="ArrowDown"?1:e.key==="ArrowUp"?-1:0)));
        const nc=Math.max(0,Math.min(p.cols-1,c+(e.key==="ArrowRight"?1:e.key==="ArrowLeft"?-1:0)));
        selectCell(nr*p.cols+nc,e.shiftKey);
      }
    };
    document.addEventListener("keydown",handler);
    return ()=>document.removeEventListener("keydown",handler);
  },[active,selection,pencil,undo,redo,rulesOpen,screen]);
  const genres=(catalog?.types||[]).filter(entry=>entry.solved>0).map(entry=>genreFor(entry.name)).filter(g=>{
    const entry=catalog?.types.find(v=>v.name===g.name);
    const words=(g.title+" "+g.description+" "+localizedTitle(g.name,language)+" "+localizedDescription(g.name,g.description,language)).toLowerCase();
    return words.includes(search.trim().toLowerCase())&&(filter==="all"||filter===gameFamily(g))&&!!entry?.solved;
  });
  const sums={types:catalog?.types.filter(v=>v.solved>0).length||0,puzzles:catalog?.types.reduce((n,v)=>n+v.count,0)||0};
  const entry=chosen&&catalog?.types.find(v=>v.name===chosen.name);
  const levelCount=totalLevels(entry||undefined);
  // Original order remains stable even when filtering by original ID size.
  const sizes=useMemo(() => [...new Set(indexedLevels.map(item=>item.size).filter(Boolean))]
    .sort((a,b)=>{const [ar,ac]=a.split("x").map(Number),[br,bc]=b.split("x").map(Number);return ar*ac-br*bc||ar-br||ac-bc;}),[indexedLevels]);
  const filteredLevels=useMemo(() => sizeFilter==="all"?indexedLevels:indexedLevels.filter(level=>level.size===sizeFilter),[indexedLevels,sizeFilter]);
  const sizeCounts=useMemo(() => {
    const counts:Record<string,number>={};
    for(const level of indexedLevels)if(level.size)counts[level.size]=(counts[level.size]||0)+1;
    return counts;
  },[indexedLevels]);
  const pageCount=Math.max(1,Math.ceil(filteredLevels.length/PAGE_SIZE));
  const ruleGenre=active?.genre||chosen;
  const isLoop=active?.genre.mode==="masyu"||active?.genre.mode==="slitherlink";
  const symbols=useMemo(()=>{
    if(!active||active.genre.mode!=="symbols")return [];
    return [...new Set(active.parsed.answer.flat().filter(v=>v!=="-"&&v!==""))]
      .sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).slice(0,18);
  },[active]);
  const canMarkEmpty=!!active?.parsed.answer.some(row=>row.includes("-"));
  const filled=active?Object.keys(snapshot.marks).filter(key=>snapshot.marks[key]!=="-").length:0;
  const allowed=active?active.parsed.rows*active.parsed.cols-Array.from({length:active.parsed.rows*active.parsed.cols},(_,i)=>i).filter(i=>isLocked(active.parsed,active.genre,Math.floor(i/active.parsed.cols),i%active.parsed.cols)).length:0;
  const levelLabel=(n:number)=>t.level+n+t.levelSuffix;
  const keyTitle=(g:Genre)=>localizedTitle(g.name,language);

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={()=>{setScreen("library");request.current++;checkVersion.current++;setActive(null);setRulesOpen(false);setMessage("");}} aria-label="puzzlesSet home">
        <span className="brand-mark"><Grid3X3 size={21}/></span><span>puzzles<span className="brand-accent">Set</span></span>
      </button>
      <div className="topbar-right">
        <span className="online-pill"><span className="offline-dot"/>{t.offline}</span>
        <button className="language-toggle" onClick={()=>setLanguage(l=>l==="zh"?"en":"zh")} aria-label={language==="zh"?"Switch to English":"切换为中文"}>{language==="zh"?"EN / 中":"中 / EN"}</button>
      </div>
    </header>

    {screen==="library"&&<main className="home">
      <section className="hero">
        <div className="hero-content">
          <div className="eyebrow"><Sparkles size={16}/>{t.heroTag}</div>
          <h1>{t.heroTitle}</h1><p>{t.heroText}</p>
          <div className="stats"><div><strong>{sums.puzzles.toLocaleString()}</strong><span>{t.count}</span></div><div><strong>{sums.types}</strong><span>{t.types}</span></div><div><strong>100%</strong><span>{t.private}</span></div></div>
        </div>
        <div className="hero-art" aria-hidden="true"><span>4</span><span>7</span><span>✦</span><span>2</span><span>◎</span><span>9</span><span>6</span><span>3</span><span>★</span></div>
      </section>
      <section className="library">
        <div className="section-heading"><div><span className="eyebrow dark">{t.library}</span><h2>{t.choose}</h2></div><span className="section-count">{sums.types} {t.types}</span></div>
        <div className="search-box"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={t.search} aria-label={t.search}/>{search&&<button onClick={()=>setSearch("")} aria-label="Clear search"><X size={18}/></button>}</div>
        <div className="filters">{([["all",t.all],["number",t.number],["shade",t.shade],["binary",t.binary],["loop",t.loop]] as const).map(([key,label])=><button key={key} onClick={()=>setFilter(key)} className={filter===key?"active":""}>{label}</button>)}</div>
        {catalogError&&<div className="notice">{t.noData} {catalogError}</div>}
        <div className="game-list">{genres.map((g,i)=>{
          const game=catalog?.types.find(v=>v.name===g.name);
          return <button className="game-card" key={g.name} onClick={()=>openLevels(g)} style={{"--tile": ["#6853be","#df7d58","#258c86","#ca9c3e","#577fcb","#bc6c94"][i%6]} as React.CSSProperties}>
            <span className="game-icon">{g.symbol}</span>
            <span className="game-copy"><strong>{keyTitle(g)}</strong><span>{localizedDescription(g.name,g.description,language)}</span><small>{totalLevels(game)} {t.available}</small></span>
            <span className="play-arrow"><ChevronRight size={22}/></span>
          </button>;
        })}</div>
        {catalog&&!genres.length&&<div className="empty-state">{t.noMatch}</div>}
      </section>
      <footer className="footer">puzzlesSet · PuzzleKit · Tauri + Rust</footer>
    </main>}

    {screen==="levels"&&chosen&&<main className="level-screen">
      <div className="breadcrumb"><button className="ghost-back" onClick={back}><ChevronLeft size={19}/>{t.back}</button><span>/</span><span>{keyTitle(chosen)}</span></div>
      <section className="level-hero">
        <div className="level-emblem">{chosen.symbol}</div>
        <div className="level-heading"><span className="eyebrow dark">{t.levelTitle}</span><h1>{keyTitle(chosen)}</h1><p>{localizedDescription(chosen.name,chosen.description,language)} · {t.selectPrompt}</p></div>
        <button className="outline-action" onClick={()=>setRulesOpen(true)}><CircleHelp size={18}/>{t.howTo}</button>
      </section>
      <div className="level-metrics"><span>{levelCount} {t.available}</span><span>{Object.keys(done).filter(k=>k.startsWith(chosen.name+":")).length} {t.solved}</span></div>
      {sizes.length>0&&<section className="size-section" aria-label={t.sizeTitle}>
        <h2>{t.sizeTitle}</h2>
        <div className="size-chips">
          <button className={sizeFilter==="all"?"selected":""} onClick={()=>{setSizeFilter("all");setPage(0);}}>{t.sizeAll} <span>{indexedLevels.length}</span></button>
          {sizes.map(size=><button key={size} className={sizeFilter===size?"selected":""} onClick={()=>{setSizeFilter(size);setPage(0);}}>
            {size.replace("x","×")} <span>{sizeCounts[size]||0}</span>
          </button>)}
        </div>
      </section>}
      <div className="level-title-row"><h2>{t.levelTitle} · {filteredLevels.length} {t.filtered}</h2><small>{t.levelHint}</small></div>
      <div className="level-grid">{filteredLevels.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE).map(level=>{
        const n=level.index+1,won=!!done[chosen.name+":"+level.index];
        return <button key={n} className={"level-tile "+(won?"level-done":"")} onClick={()=>loadLevel(chosen,level.index)} disabled={loading||indexing||!level.ready}
          title={!level.ready?t.unavailable:level.id} aria-label={levelLabel(n)+(level.size?" "+level.size.replace("x","×"):"")}>
          <strong>{String(n).padStart(2,"0")}</strong><small className="level-id">{level.id}</small>{won&&<CheckCircle2 size={16}/>}
        </button>;
      })}</div>
      {!indexing&&filteredLevels.length===0&&<div className="empty-state">{t.levelsEmpty}</div>}
      {(loading||indexing)&&<div className="notice">{t.load}</div>}
      {message&&<div className="notice" role="status">{message}</div>}
      {pageCount>1&&<div className="pagination"><button disabled={page===0||loading||indexing} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={19}/>{t.previous}</button><span>{page+1} / {pageCount}</span><button disabled={page===pageCount-1||loading||indexing} onClick={()=>setPage(p=>p+1)}>{t.next}<ChevronRight size={19}/></button></div>}
    </main>}

    {screen==="game"&&active&&<main className="playing">
      <div className="play-heading">
        <button className="circle-button" aria-label={t.backLevels} onClick={back}><ChevronLeft size={23}/></button>
        <div className="puzzle-info"><span className="eyebrow dark">{levelLabel(active.level+1)}</span><h2>{keyTitle(active.genre)}</h2><small>{active.parsed.rows} × {active.parsed.cols} · {active.record.id}</small></div>
        <button className="rules-shortcut" onClick={()=>setRulesOpen(true)}><CircleHelp size={19}/><span>{t.help}</span></button>
      </div>
      <div className="puzzle-stage">
        <div className="stage-top"><span><span className="stage-dot"/> {t.board}</span><span>{isLoop?snapshot.edges.length:filled+" / "+allowed}</span></div>
        <div className="board-area"><Board parsed={active.parsed} genre={active.genre} state={snapshot} selected={selection} multi={multi} onSelect={selectCell} onTap={tap} onEdge={edgeAction} label={keyTitle(active.genre)}/></div>
        <div className="board-legend" aria-label={t.legends}><span><i className="legend-given"/> {t.given}</span><span><i className="legend-player"/> {t.yours}</span></div>
      </div>
      <div className="game-controls">
        <div className="toolbar">
          <button className="tool" onClick={undo} disabled={!timeline.current.past.length}><Undo2 size={20}/><span>{t.undo}</span></button>
          <button className="tool" onClick={redo} disabled={!timeline.current.future.length}><Redo2 size={20}/><span>{t.redo}</span></button>
          <button className={"tool "+(multi?"tool-active":"")} onClick={()=>setMulti(v=>!v)}><Layers size={20}/><span>{t.multi}</span></button>
          {active.genre.mode==="number"&&<button className={"tool "+(pencil?"tool-active":"")} onClick={()=>setPencil(v=>!v)}><Pencil size={20}/><span>{t.notes}</span></button>}
          <button className="tool" onClick={reset}><RotateCcw size={20}/><span>{t.reset}</span></button>
        </div>
        {active.genre.mode==="number"&&<div className="keypad">
          <div className="numbers">{Array.from({length:Math.min(9,Math.max(active.parsed.rows,active.parsed.cols))},(_,i)=>i+1).map(n=><button className="key" key={n} onClick={()=>enter(String(n))}>{n}</button>)}</div>
          <div className="keypad-bottom"><div className="wide-entry"><input inputMode="numeric" aria-label={t.numberPlaceholder} placeholder={t.numberPlaceholder} value={inputValue} onChange={e=>setInputValue(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&/^\d+$/.test(inputValue)){enter(inputValue);setInputValue("");}}}/><button onClick={()=>{if(/^\d+$/.test(inputValue)){enter(inputValue);setInputValue("");}}}>{t.enter}</button></div>
          {(active.genre.name==="Fuzuli"||active.genre.adaptive&&canMarkEmpty)&&<button className="erase" onClick={()=>enter("~")}>{t.markEmpty}</button>}
          <button className="erase" onClick={()=>enter("-")}><Eraser size={17}/>{t.clear}</button></div>
        </div>}
        {active.genre.mode==="symbols"&&<div className="keypad">
          <div className="numbers">{symbols.map(v=><button className="key" key={v} onClick={()=>enter(v)}>{v}</button>)}</div>
          <div className="keypad-bottom"><div className="wide-entry"><input aria-label={t.numberPlaceholder} placeholder={t.numberPlaceholder} value={inputValue} onChange={e=>setInputValue(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&inputValue.trim()){enter(inputValue.trim());setInputValue("");}}}/><button onClick={()=>{if(inputValue.trim()){enter(inputValue.trim());setInputValue("");}}}>{t.enter}</button></div>
          {canMarkEmpty&&<button className="erase" onClick={()=>enter("~")}>{t.markEmpty}</button>}
          <button className="erase" onClick={()=>enter("-")}><Eraser size={17}/>{t.clear}</button></div>
        </div>}
        {active.genre.mode==="binary"&&<div className="choice-row"><button onClick={()=>enter("b")}><span className="choice-dot dark"/> {t.black}</button><button onClick={()=>enter("w")}><span className="choice-dot light"/> {t.white}</button><button onClick={()=>enter("-")}><Eraser size={17}/>{t.clear}</button></div>}
        {(active.genre.mode==="shade"||active.genre.mode==="nonogram")&&<div className="choice-row"><button onClick={()=>enter("x")}>{active.genre.name==="Starbattle"?"★":active.genre.name==="Akari"?"☀":"■"} {active.genre.name==="Starbattle"?t.star:active.genre.name==="Akari"?t.bulb:t.fill}</button><button onClick={()=>enter("w")}>□ {t.empty}</button><button onClick={()=>enter("-")}><Eraser size={17}/>{t.clear}</button></div>}
        <p className="control-tip">{isLoop?t.tipLoop:active.genre.mode==="number"?t.tipNumber:active.genre.mode==="binary"?t.tipBinary:t.tipShade}</p>
        {message&&<div role="status" className={"result "+resultKind}>{message}</div>}
        <div className="play-actions"><button className="check-button" onClick={check}><CheckCircle2 size={21}/>{t.check}</button><button className="secondary-button" onClick={()=>setRulesOpen(true)}><CircleHelp size={19}/>{t.help}</button></div>
        <div className="level-stepper"><button disabled={active.level<=0||loading} onClick={()=>loadLevel(active.genre,active.level-1)}><ArrowLeft size={17}/>{t.previous}</button><button onClick={()=>openLevels(active.genre)}>{t.backLevels}</button><button disabled={active.level+1>=totalLevels(catalog?.types.find(v=>v.name===active.genre.name))||loading} onClick={()=>loadLevel(active.genre,active.level+1)}>{t.next}<ArrowRight size={17}/></button></div>
        <p className="save-note">{t.saved}</p>
      </div>
    </main>}

    {rulesOpen&&ruleGenre&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setRulesOpen(false);}}>
      <section className="rules-dialog" role="dialog" aria-modal="true" aria-labelledby="rules-heading">
        <div className="dialog-title"><span className="dialog-icon">{ruleGenre.symbol}</span><div><small>{t.rulesTitle}</small><h2 id="rules-heading">{keyTitle(ruleGenre)}</h2></div><button className="close-modal" onClick={()=>setRulesOpen(false)} aria-label="Close rules"><X size={22}/></button></div>
        <p className="rule-intro">{localizedDescription(ruleGenre.name,ruleGenre.description,language)}</p>
        {localizedRules(ruleGenre.name,language).length>0
          ?<ol className="rule-list">{localizedRules(ruleGenre.name,language).map((rule,i)=><li key={i}>{rule}</li>)}</ol>
          :<p className="rule-intro">{t.rulesFallback}</p>}
        {active?.genre.name===ruleGenre.name&&/^https?:\\/\\//.test(active.record.source||"")&&
          <p className="rule-intro"><a href={active.record.source} target="_blank" rel="noopener noreferrer">{t.source}</a></p>}
        <button className="check-button modal-cta" onClick={()=>setRulesOpen(false)}><Play size={19}/>{t.gotIt}</button>
      </section>
    </div>}
  </div>;
}
export default App;
