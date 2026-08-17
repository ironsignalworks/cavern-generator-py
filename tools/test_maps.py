#!/usr/bin/env python3
"""Quick tests for the cavern generator and the shipped map bank.

  python tools/test_maps.py
"""
from __future__ import annotations

import json
import re
import sys
import unittest
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
ROOT = TOOLS.parent
sys.path.insert(0, str(TOOLS))

import generate_maps as gen  # noqa: E402

SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv"}
BRAND_NEEDLES = (
    "ironsignalworks",
    "iron signal works",
    "ironsignalworks.com",
)


def js_layout_sizes(src: str) -> dict[str, dict[str, int]]:
    block = re.search(r"export const LAYOUTS = \{([\s\S]*?)\};", src)
    if not block:
        raise AssertionError("LAYOUTS not found in js/config.js")
    found = {}
    for name, w, h in re.findall(r"(\w+):\s*\{\s*w:\s*(\d+),\s*h:\s*(\d+)\s*\}", block.group(1)):
        found[name] = {"w": int(w), "h": int(h)}
    return found


def js_level_keys(src: str) -> list[str]:
    block = re.search(r"export const LEVELS = \[([\s\S]*?)\];", src)
    if not block:
        raise AssertionError("LEVELS not found in js/config.js")
    return re.findall(r"key:\s*'([a-z]+)'", block.group(1))


class TestGenerator(unittest.TestCase):
    def test_same_seed_same_cells(self):
        opts = gen.LEVELS[1]["complexity"]
        a = gen.generate(60, 30, 1100, opts)
        b = gen.generate(60, 30, 1100, opts)
        self.assertEqual(a, b)

    def test_different_seeds_diverge(self):
        opts = gen.LEVELS[1]["complexity"]
        a = gen.generate(60, 30, 1100, opts)
        b = gen.generate(60, 30, 1101, opts)
        self.assertNotEqual(a, b)

    def test_invariants_every_level_layout(self):
        for li, spec in enumerate(gen.LEVELS):
            for layout_name, size in gen.LAYOUTS.items():
                seed = gen.seed_for(li, layout_name, 0)
                cells = gen.generate(size["w"], size["h"], seed, spec["complexity"])
                errs = gen.validate(cells, size["w"], size["h"])
                self.assertEqual(errs, [], msg=f"{spec['key']}/{layout_name}/seed={seed}: {errs}")
                floors = sum(1 for c in cells if c == gen.FLOOR)
                self.assertGreater(floors, 0, msg=f"{spec['key']} has no floors")

    def test_pack_roundtrip_length(self):
        cells = gen.generate(34, 52, 1050, gen.LEVELS[0]["complexity"])
        packed = gen.pack(cells)
        self.assertEqual(len(packed), 34 * 52)
        self.assertTrue(set(packed) <= {"0", "1"})
        self.assertEqual([1 if ch == "1" else 0 for ch in packed], cells)

    def test_ascii_matches_grid(self):
        cells = gen.generate(60, 30, 1100, gen.LEVELS[1]["complexity"])
        art = gen.to_ascii(cells, 60, 30)
        rows = art.splitlines()
        self.assertEqual(len(rows), 30)
        self.assertTrue(all(len(r) == 60 for r in rows))
        self.assertEqual(rows[0], "#" * 60)
        self.assertEqual(rows[-1], "#" * 60)


class TestShippedBank(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        path = ROOT / "data" / "maps.json"
        cls.bank = json.loads(path.read_text(encoding="utf-8"))

    def test_bank_layouts_match_cli(self):
        self.assertEqual(self.bank["layouts"], gen.LAYOUTS)

    def test_bank_level_keys_match_cli(self):
        self.assertEqual(list(self.bank["levels"]), [spec["key"] for spec in gen.LEVELS])

    def test_bank_matches_generator(self):
        """Shipped JSON must be a fresh bake of the current CLI."""
        for li, spec in enumerate(gen.LEVELS):
            for layout_name, size in gen.LAYOUTS.items():
                pool = self.bank["levels"][spec["key"]][layout_name]
                self.assertGreaterEqual(len(pool), 1, msg=f"empty pool {spec['key']}/{layout_name}")
                for entry in pool:
                    cells = gen.generate(entry["w"], entry["h"], entry["seed"], spec["complexity"])
                    self.assertEqual(entry["w"], size["w"])
                    self.assertEqual(entry["h"], size["h"])
                    self.assertEqual(
                        entry["cells"],
                        gen.pack(cells),
                        msg=f"stale map {spec['key']}/{layout_name}/seed={entry['seed']}: re-run generate_maps.py",
                    )
                    errs = gen.validate(cells, size["w"], size["h"])
                    self.assertEqual(errs, [])


class TestJsContract(unittest.TestCase):
    def test_config_keys_and_sizes(self):
        src = (ROOT / "js" / "config.js").read_text(encoding="utf-8")
        self.assertEqual(js_layout_sizes(src), gen.LAYOUTS)
        self.assertEqual(js_level_keys(src), [spec["key"] for spec in gen.LEVELS])
        self.assertNotIn("complexity", src)


class TestBranding(unittest.TestCase):
    def test_no_prior_studio_name(self):
        hits = []
        for path in ROOT.rglob("*"):
            if any(part in SKIP_DIRS for part in path.parts):
                continue
            if not path.is_file() or path.suffix.lower() not in {".html", ".md", ".js", ".css", ".py", ".yml", ".json"}:
                continue
            if path.name == Path(__file__).name:
                continue
            text = path.read_text(encoding="utf-8", errors="ignore").lower()
            for needle in BRAND_NEEDLES:
                if needle in text:
                    hits.append(f"{path.relative_to(ROOT)}:{needle}")
        self.assertEqual(hits, [], msg="old studio branding still present:\n" + "\n".join(hits))


if __name__ == "__main__":
    unittest.main(verbosity=2)
