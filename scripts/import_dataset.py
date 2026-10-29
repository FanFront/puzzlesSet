#!/usr/bin/env python3
"""Import PuzzleKit's JSON shards as lazy-loaded, offline app assets.

All genres are mirrored with --all; the UI only advertises genres with controls.
No runtime GitHub/network dependency: APK includes the imported JSON files.
"""
import argparse
import datetime as dt
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "puzzles"
PLAYABLE = {
    "Sudoku", "Hidoku", "Hakyuu", "Suguru", "JigsawSudoku", "KenKen",
    "KillerSudoku", "Cojun", "Fuzuli", "Binairo", "YinYang", "Hitori",
    "Nurikabe", "Kurotto", "Kuromasu", "Norinori", "Heyawake", "Chocona",
    "LITS", "Starbattle", "Minesweeper", "Akari", "Shimaguni", "Mosaic",
    "Nonogram", "Masyu", "Slitherlink",
}


def normalize_case(case_id, raw):
    if not isinstance(raw, dict):
        return None
    problem = raw.get("problem", "")
    solution = raw.get("solution", "")
    if not isinstance(problem, str) or not problem.strip():
        return None
    if not isinstance(solution, str):
        solution = ""
    header = problem.splitlines()[0].split()
    if len(header) < 2 or not all(x.isdigit() for x in header[:2]):
        return None
    rows, cols = (int(x) for x in header[:2])
    if rows < 1 or cols < 1 or rows > 120 or cols > 120:
        return None
    return {
        "id": str(case_id),
        "problem": problem,
        "solution": solution,
        "source": str(raw.get("source") or ""),
        "info": str(raw.get("info") or ""),
    }


def import_data(source: Path, all_types=False, limit=0):
    if not source.is_dir():
        raise FileNotFoundError("Expected dataset assets/data directory: " + str(source))
    OUT.mkdir(parents=True, exist_ok=True)
    # Generated assets are disposable: replace them atomically per run.
    for previous in OUT.iterdir():
        if previous.is_dir():
            shutil.rmtree(previous)
        elif previous.is_file() and previous.name != ".gitkeep":
            previous.unlink()
    catalog = {
        "source": "https://github.com/SmilingWayne/puzzlekit-dataset",
        "imported_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "types": [],
    }
    for folder in sorted(source.iterdir()):
        if not folder.is_dir() or (not all_types and folder.name not in PLAYABLE):
            continue
        files = sorted(folder.glob("*_dataset_*.json"))
        if not files:
            files = sorted(folder.glob("*_dataset.json"))
        if not files:
            continue
        target = OUT / folder.name
        target.mkdir(parents=True, exist_ok=True)
        output_files, seen = [], set()
        count = solved = 0
        batch = []
        # Repack by chunks of 200 cases so mobile loads only one small file at a time.
        def write_batch():
            if not batch:
                return
            name = f"{len(output_files):03d}.json"
            (target / name).write_text(json.dumps({"puzzles": batch}, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
            output_files.append({
                "path": folder.name + "/" + name,
                "count": len(batch),
                # Indexed once at import time; level selection never needs a remote lookup.
                "sizes": ["{}x{}".format(*(int(x) for x in item["problem"].splitlines()[0].split()[:2])) for item in batch],
                "ready": [bool(item["solution"].strip()) and
                          max(int(x) for x in item["problem"].splitlines()[0].split()[:2]) <= 20
                          and folder.name in PLAYABLE for item in batch],
            })
            batch.clear()

        for shard in files:
            try:
                payload = json.loads(shard.read_text(encoding="utf-8"))
            except (ValueError, UnicodeDecodeError) as exc:
                print("Skipping unreadable shard", shard, exc)
                continue
            for case_id, item in (payload.get("data") or {}).items():
                case = normalize_case(case_id, item)
                if not case:
                    continue
                # IDs may repeat between shards. Name + fingerprint always identifies an instance.
                identity = (case["id"], case["problem"])
                if identity in seen:
                    continue
                seen.add(identity)
                batch.append(case)
                count += 1
                solved += bool(case["solution"].strip())
                if len(batch) >= 200:
                    write_batch()
                if limit and count >= limit:
                    break
            if limit and count >= limit:
                break
        write_batch()
        if not output_files:
            target.rmdir()
            continue
        catalog["types"].append({
            "name": folder.name, "count": count, "solved": solved,
            "playable": folder.name in PLAYABLE, "files": output_files
        })
        print(f"{folder.name}: {count} puzzles ({solved} with solutions)")
    (OUT / "catalog.json").write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("Imported", sum(t["count"] for t in catalog["types"]), "puzzles across", len(catalog["types"]), "types")
    return catalog


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--source", type=Path, help="Local checkout's assets/data folder")
    p.add_argument("--all", action="store_true", help="Mirror all types, even those without playable controls yet")
    p.add_argument("--limit-per-type", type=int, default=0, help="For small sample imports (0 means all)")
    args = p.parse_args()
    if args.source:
        import_data(args.source, args.all, args.limit_per_type)
    else:
        with tempfile.TemporaryDirectory() as temp:
            dest = Path(temp) / "puzzlekit-dataset"
            subprocess.run(["git", "clone", "--depth", "1",
                            "https://github.com/SmilingWayne/puzzlekit-dataset.git", str(dest)], check=True)
            import_data(dest / "assets" / "data", args.all, args.limit_per_type)


if __name__ == "__main__":
    main()
