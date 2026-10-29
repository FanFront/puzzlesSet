# puzzlesSet

An **offline-first Android logic puzzle app**, built with Tauri 2, Rust, React, and TypeScript. Puzzles and stored answers come from [SmilingWayne/puzzlekit-dataset](https://github.com/SmilingWayne/puzzlekit-dataset). There is **no solver** in this release.

## Playable first batch

27 puzzle genres, sharing controls across 5 input models:

- Numbers: Sudoku, Hidoku, Hakyuu, Suguru, Jigsaw Sudoku, KenKen, Killer Sudoku, Cojun, Fuzuli
- Binary: Binairo, Yin–Yang
- Shading: Hitori, Nurikabe, Kurotto, Kuromasu, Norinori, Heyawake, Chocona, LITS, Star Battle, Minesweeper, Akari, Shimaguni, Mosaic
- Picture clues: Nonogram
- Loops: Masyu, Slitherlink

Includes number entry, small superscript **Notes** (pencil mode), **Multi** selection (including drag selection), shade/binary/line input, Undo/Redo, Reset, New Puzzle, automatic local saves, and Check Answer.

**Check Answer** checks the player's state against the dataset solution. The comparison runs in Rust inside Android and falls back to JavaScript in browser development. No solver, hints, or alternate-solution validation is performed. The game currently loads solved instances up to 20×20 for touch usability. Larger puzzles remain imported for later.

## Import the dataset

The importer takes the upstream numbered JSON shards and generates offline browser assets in gitignored **public/puzzles/**. Those local files are bundled into the APK; the installed app never needs to download puzzles.

Local development:

~~~bash
npm install
npm run data:sync         # clones PuzzleKit dataset, imports playable genres
npm run dev
~~~

Import every available puzzle type, even not-yet-playable types:

~~~bash
python3 scripts/import_dataset.py --all
~~~

Or from an existing checkout:

~~~bash
python3 scripts/import_dataset.py --source ../puzzlekit-dataset/assets/data --all
~~~

The importer preserves the puzzle ID, problem, solution, source, and info, repacks into lazy-loaded chunks of 200, and generates catalog.json with counts and supported flags. Records without solutions remain mirrored but are not offered for play. Running sync replaces the previous generated assets. Dataset contents can change upstream; pin the upstream revision for a release freeze.

## Build an installable Android APK

The workflow [.github/workflows/android.yml](.github/workflows/android.yml) installs the Android SDK/NDK and Rust target, checks out the upstream PuzzleKit dataset, imports **all** puzzle types, generates app icons, initializes Tauri Android, compiles the arm64 APK, and uploads an **Actions artifact** named puzzlesSet-android-arm64.

Push to main or run **GitHub → Actions → Build Android APK → Run workflow**. Open the successful workflow run and download the APK artifact. You can also build it locally with Android SDK/NDK installed:

~~~bash
npm install
npm run data:sync
npx tauri icon public/icon.svg
npx tauri android init
npx tauri android build --apk --target aarch64
~~~

The APK is for testing/sideloading. Production publishing requires signing keys and distribution review. Full setup requirements: https://v2.tauri.app/start/prerequisites/

## Architecture

- src/: React UI, puzzle data adapters, grid renderers, game state, undo/redo and offline progress
- src-tauri/src/lib.rs: native Rust checker (Tauri invoke)
- scripts/import_dataset.py: reproducible dataset import from PuzzleKit
- public/puzzles/: generated offline app assets, not tracked in Git
- .github/workflows/android.yml: CI build with APK artifact

## Caveats

This initial release checks **exact stored answers**, not logical correctness; other valid solutions can fail. Some puzzle formats encode answers differently from their input (e.g. Masyu directional cells; Slitherlink inside/outside shading); adapters normalize them for interaction. Other genres are imported for future releases but are not advertised as playable. Large grids need further mobile accessibility work. Undo history is session-only; current state is saved between sessions.

**Data provenance:** The solver source repository uses MIT, but the dataset consists of third-party puzzles with varying source URLs. Review dataset redistribution and commercial-use rights before broad release or publication. Do not assume the solver license covers third-party puzzle content.
