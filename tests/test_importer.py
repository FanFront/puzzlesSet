import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from scripts import import_dataset as importer


class ImporterTests(unittest.TestCase):
    def test_json_shard_repack_and_counts(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            upstream = root / "assets" / "data"
            example = upstream / "Sudoku"
            example.mkdir(parents=True)
            (example / "Sudoku_dataset_000.json").write_text(json.dumps({
                "name": "Sudoku", "count": 2, "count_sol": 1,
                "data": {
                    "01_2x2": {"problem": "2 2\n1 -\n- 2", "solution": "2 2\n1 2\n2 1", "source": "original"},
                    "02_2x2": {"problem": "2 2\n- 1\n2 -", "solution": "", "source": ""}
                }
            }))
            with patch.object(importer, "OUT", root / "output"):
                catalog = importer.import_data(upstream)
                self.assertEqual(catalog["types"][0]["count"], 2)
                self.assertEqual(catalog["types"][0]["solved"], 1)
                self.assertEqual(catalog["types"][0]["files"][0], {"path": "Sudoku/000.json", "count": 2})
                self.assertTrue(catalog["types"][0]["playable"])
                game = json.loads((root / "output" / "Sudoku" / "000.json").read_text())
                self.assertEqual(len(game["puzzles"]), 2)
                self.assertEqual(game["puzzles"][0]["id"], "01_2x2")
                self.assertEqual(game["puzzles"][0]["solution"], "2 2\n1 2\n2 1")

    def test_all_families_imported_without_generated_grid_metadata(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            upstream = root / "assets" / "data"
            for name in ("Sudoku", "Aqre"):
                directory = upstream / name
                directory.mkdir(parents=True)
                (directory / f"{name}_dataset_000.json").write_text(json.dumps({
                    "data": {
                        "20_12x12": {
                            "problem": "2 2\n- -\n- -",
                            "solution": "2 2\nx -\n- x",
                        }
                    }
                }))
            with patch.object(importer, "OUT", root / "output"):
                catalog = importer.import_data(upstream)
                self.assertEqual({x["name"] for x in catalog["types"]}, {"Aqre", "Sudoku"})
                for puzzle_type in catalog["types"]:
                    self.assertEqual(puzzle_type["files"][0]["count"], 1)
                    self.assertNotIn("sizes", puzzle_type["files"][0])
                    self.assertNotIn("ready", puzzle_type["files"][0])
                    shard = json.loads((root / "output" / puzzle_type["name"] / "000.json").read_text())
                    self.assertEqual(shard["puzzles"][0]["id"], "20_12x12")

    def test_rejects_invalid_puzzle(self):
        self.assertIsNone(importer.normalize_case("bad", {"problem": "abc", "solution": ""}))


if __name__ == "__main__":
    unittest.main()
