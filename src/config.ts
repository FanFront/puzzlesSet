import type { Genre } from "./types";
// Only genres with tested interaction models are advertised as playable.
// This is separate from the dataset: we still mirror every puzzle type.
export const GENRES: Genre[] = [
  {name:"Sudoku",title:"Sudoku",mode:"number",symbol:"🔢",description:"Classic number placement"},
  {name:"Hidoku",title:"Hidoku",mode:"number",symbol:"🔢",description:"Find a sequence"},
  {name:"Hakyuu",title:"Hakyuu",mode:"number",symbol:"🔢",description:"Region and distance numbers"},
  {name:"Suguru",title:"Suguru",mode:"number",symbol:"🔢",description:"Fill irregular regions"},
  {name:"JigsawSudoku",title:"Jigsaw Sudoku",mode:"number",symbol:"🧩",description:"Sudoku with irregular boxes"},
  {name:"KenKen",title:"KenKen",mode:"number",symbol:"➗",description:"Arithmetic cages",clueOnly:true},
  {name:"KillerSudoku",title:"Killer Sudoku",mode:"number",symbol:"➕",description:"Cage sums",clueOnly:true},
  {name:"Cojun",title:"Cojun",mode:"number",symbol:"🔢",description:"Number regions"},
  {name:"Fuzuli",title:"Fuzuli",mode:"number",symbol:"🔢",description:"Number placement"},
  {name:"Binairo",title:"Binairo",mode:"binary",symbol:"◐",description:"Black and white patterns"},
  {name:"YinYang",title:"Yin–Yang",mode:"binary",symbol:"☯",description:"Balance light and dark"},
  {name:"Hitori",title:"Hitori",mode:"shade",symbol:"◩",description:"Shade repeated numbers"},
  {name:"Nurikabe",title:"Nurikabe",mode:"shade",symbol:"▦",description:"Islands and sea"},
  {name:"Kurotto",title:"Kurotto",mode:"shade",symbol:"●",description:"Shade regions"},
  {name:"Kuromasu",title:"Kuromasu",mode:"shade",symbol:"◧",description:"Visible cells"},
  {name:"Norinori",title:"Norinori",mode:"shade",symbol:"▤",description:"Pairs in regions",regionOnly:true},
  {name:"Heyawake",title:"Heyawake",mode:"shade",symbol:"▥",description:"Shaded rectangles"},
  {name:"Chocona",title:"Chocona",mode:"shade",symbol:"▧",description:"Shading by region"},
  {name:"LITS",title:"LITS",mode:"shade",symbol:"▨",description:"Tetromino shading",regionOnly:true},
  {name:"Starbattle",title:"Star Battle",mode:"shade",symbol:"★",description:"Place stars in regions",regionOnly:true},
  {name:"Minesweeper",title:"Minesweeper",mode:"shade",symbol:"✹",description:"Mark the hidden mines"},
  {name:"Akari",title:"Akari",mode:"shade",symbol:"☀",description:"Place light bulbs"},
  {name:"Shimaguni",title:"Shimaguni",mode:"shade",symbol:"▦",description:"Shaded islands"},
  {name:"Mosaic",title:"Mosaic",mode:"shade",symbol:"▩",description:"Paint a pixel picture"},
  {name:"Nonogram",title:"Nonogram",mode:"nonogram",symbol:"▥",description:"Picture logic"},
  {name:"Masyu",title:"Masyu",mode:"masyu",symbol:"◎",description:"Draw a pearl loop"},
  {name:"Slitherlink",title:"Slitherlink",mode:"slitherlink",symbol:"⬡",description:"Draw a single loop"}
];
export const GENRE_MAP = new Map(GENRES.map(g=>[g.name,g]));

/** Unknown upstream genres remain in the library. Their controls are detected
 * from each stored answer, not hardcoded or guessed from the puzzle name. */
export function genreFor(name:string): Genre {
  return GENRE_MAP.get(name) || {
    name, title:name, mode:"symbols", symbol:"🧩",
    description:"Grid-based logic puzzle", adaptive:true
  };
}
