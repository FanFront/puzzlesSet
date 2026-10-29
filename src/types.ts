export type Language = "zh" | "en";
export type Mode = "number" | "binary" | "shade" | "nonogram" | "masyu" | "slitherlink" | "symbols" | "mixed";
export type Genre = { name: string; title: string; mode: Mode; symbol: string; description: string; regionOnly?: boolean; clueOnly?: boolean; adaptive?: boolean };
export type PuzzleRecord = { id: string; problem: string; solution: string; source?: string; info?: string };
export type CatalogFile = { path: string; count: number };
export type CatalogType = { name: string; count: number; solved: number; playable: boolean; files: CatalogFile[] };
export type Catalog = { source: string; imported_at?: string; types: CatalogType[] };
export type ParsedPuzzle = {
  rows: number; cols: number; clues: string[][]; answer: string[][];
  regions?: string[][]; rowClues?: string[][]; colClues?: string[][];
};
export type Snapshot = { marks: Record<string,string>; notes: Record<string,string[]>; edges: string[] };
export type Check = { hasWrong: boolean; checked: number };
