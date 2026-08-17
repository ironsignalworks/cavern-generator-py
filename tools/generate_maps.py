#!/usr/bin/env python3
"""Bake KOMMANDO caverns into data/maps.json.

The live game is static JS on GitHub Pages. This CLI is the map source of
truth: run it whenever LEVELS or LAYOUTS change, then commit the JSON.

Why offline: browser-side generation is hard to tune, non-deterministic
across reloads, and couples layout experiments to the game loop. Baking a
bank lets each level pick a known-good cavern (landscape + portrait) while
the JS only unpacks, FOV-casts, and plays.

  python tools/generate_maps.py
  python tools/generate_maps.py --preview --level jungle --layout landscape
  python tools/generate_maps.py --check
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Wall = 1, floor = 0. Packed JSON uses the same digits as a string.
WALL, FLOOR = 1, 0
MIN_FLOOR_RATIO = 0.20
ROOM_ATTEMPT_MUL = 40

LAYOUTS = {
    "landscape": {"w": 60, "h": 30},
    "portrait": {"w": 34, "h": 52},
}

# rooms: chambers to place. connectors: extra loops after the spanning tree.
# carveSeeds / carveStepMul: how aggressively leftover rock is mazed.
LEVELS = [
    {"key": "reality", "complexity": {"rooms": 10, "connectors": 3, "carveSeeds": 1, "carveStepMul": 1.10}},
    {"key": "jungle", "complexity": {"rooms": 14, "connectors": 5, "carveSeeds": 3, "carveStepMul": 1.60}},
    {"key": "paranoia", "complexity": {"rooms": 15, "connectors": 5, "carveSeeds": 3, "carveStepMul": 1.35}},
    {"key": "psychosis", "complexity": {"rooms": 16, "connectors": 6, "carveSeeds": 4, "carveStepMul": 1.45}},
    {"key": "collapse", "complexity": {"rooms": 18, "connectors": 7, "carveSeeds": 4, "carveStepMul": 1.60}},
]


class RNG:
    """32-bit xorshift. Same seed always yields the same cavern."""

    def __init__(self, seed: int) -> None:
        self.s = seed & 0xFFFFFFFF

    def next(self) -> float:
        x = self.s
        x ^= (x << 13) & 0xFFFFFFFF
        x ^= (x >> 17) & 0xFFFFFFFF
        x ^= (x << 5) & 0xFFFFFFFF
        self.s = x & 0xFFFFFFFF
        return self.s / 0xFFFFFFFF

    def randint(self, n: int) -> int:
        if n <= 0:
            return 0
        return min(n - 1, int(self.next() * n))


def idx(w: int, x: int, y: int) -> int:
    return y * w + x


def generate(w: int, h: int, seed: int, opts: dict) -> list[int]:
    """Carve one cavern. Stage order is load-bearing (RNG + connectivity)."""
    rng = RNG(seed)
    cells = [WALL] * (w * h)
    rooms = place_rooms(cells, w, h, rng, int(opts.get("rooms", 10)))
    connect_rooms(cells, w, h, rooms, rng, int(opts.get("connectors", 2)))
    if "carveSeeds" in opts:
        carve_seeds = int(opts["carveSeeds"])
    else:
        carve_seeds = 1 + rng.randint(2)
    carve_sparse_maze(
        cells,
        w,
        h,
        rng,
        carve_seeds,
        float(opts.get("carveStepMul", 1.0)),
    )
    keep_largest_region(cells, w, h)
    erode_if_cramped(cells, w, h)
    seal_border(cells, w, h)
    return cells


def place_rooms(cells: list[int], w: int, h: int, rng: RNG, target: int) -> list[dict]:
    """Scatter non-overlapping chambers. Readable rooms first; rock later.

    A 1-tile gap is required so two rooms never fuse into one blob. Failed
    placements still consume RNG so a seed stays stable if `target` changes
    only the attempt cap, not the roll sequence mid-loop.
    """
    rooms: list[dict] = []
    attempts = 0
    while len(rooms) < target and attempts < target * ROOM_ATTEMPT_MUL:
        attempts += 1
        large = rng.next() < 0.45
        rw = (10 + rng.randint(8)) if large else (4 + rng.randint(4))
        rh = (6 + rng.randint(5)) if large else (3 + rng.randint(3))
        rx = 2 + rng.randint(max(2, w - rw - 4))
        ry = 2 + rng.randint(max(2, h - rh - 4))
        rect = {"x": rx, "y": ry, "w": rw, "h": rh, "cx": rx + rw // 2, "cy": ry + rh // 2}
        if any(_rooms_overlap(rect, other) for other in rooms):
            continue
        rooms.append(rect)
        _carve_rect(cells, w, h, rect["x"], rect["y"], rect["x"] + rect["w"], rect["y"] + rect["h"])
    return rooms


def _rooms_overlap(a: dict, b: dict) -> bool:
    return not (
        a["x"] + a["w"] + 1 < b["x"]
        or b["x"] + b["w"] + 1 < a["x"]
        or a["y"] + a["h"] + 1 < b["y"]
        or b["y"] + b["h"] + 1 < a["y"]
    )


def _carve_rect(cells: list[int], w: int, h: int, x0: int, y0: int, x1: int, y1: int) -> None:
    x_a = max(1, min(x0, x1))
    x_b = min(w - 2, max(x0, x1))
    y_a = max(1, min(y0, y1))
    y_b = min(h - 2, max(y0, y1))
    for y in range(y_a, y_b + 1):
        for x in range(x_a, x_b + 1):
            cells[idx(w, x, y)] = FLOOR


def connect_rooms(
    cells: list[int],
    w: int,
    h: int,
    rooms: list[dict],
    rng: RNG,
    extra_connect: int,
) -> None:
    """Spanning tree of L-tunnels, then extra random edges for loops.

    Prim-style nearest unused center: every room is reachable, corridors stay
    short. Extra connectors are flanking routes so drones and the player are
    not forced onto a single spine.
    """
    centers = [(r["cx"], r["cy"]) for r in rooms]
    if not centers:
        return
    n = len(centers)
    used = [False] * n
    used[0] = True
    edges = 0
    while edges < n - 1:
        best_a = best_b = -1
        best_d = 10**9
        for a in range(n):
            if not used[a]:
                continue
            for b in range(n):
                if used[b]:
                    continue
                dx = centers[a][0] - centers[b][0]
                dy = centers[a][1] - centers[b][1]
                d = dx * dx + dy * dy
                if d < best_d:
                    best_d = d
                    best_a, best_b = a, b
        if best_b == -1:
            break
        used[best_b] = True
        edges += 1
        _dig_l(cells, w, centers[best_a][0], centers[best_a][1], centers[best_b][0], centers[best_b][1])
    for _ in range(extra_connect):
        a, b = rng.randint(n), rng.randint(n)
        if a != b:
            _dig_l(cells, w, centers[a][0], centers[a][1], centers[b][0], centers[b][1])


def _dig_l(cells: list[int], w: int, ax: int, ay: int, bx: int, by: int) -> None:
    x, y = ax, ay
    while x != bx:
        x += 1 if bx > x else -1
        cells[idx(w, x, y)] = FLOOR
    while y != by:
        y += 1 if by > y else -1
        cells[idx(w, x, y)] = FLOOR
    cells[idx(w, bx, by)] = FLOOR


def carve_sparse_maze(
    cells: list[int],
    w: int,
    h: int,
    rng: RNG,
    carve_seeds: int,
    carve_step_mul: float,
) -> None:
    """Bounded recursive-backtracker on the odd inner grid.

    Rooms sit in leftover rock; this eats some of that rock into 1-tile
    passages without turning the whole map into a perfect maze. Step budget
    scales with area so portrait and landscape stay in the same density band.
    """
    dirs = [(2, 0), (-2, 0), (0, 2), (0, -2)]

    def in_odd_grid(x: int, y: int) -> bool:
        return x > 1 and y > 1 and x < w - 2 and y < h - 2 and x % 2 == 1 and y % 2 == 1

    def shuffle(arr: list) -> list:
        a = list(arr)
        for i in range(len(a) - 1, 0, -1):
            j = rng.randint(i + 1)
            a[i], a[j] = a[j], a[i]
        return a

    def walk(sx: int, sy: int, steps_max: int) -> None:
        steps = 0
        st = [(sx, sy)]
        cells[idx(w, sx, sy)] = FLOOR
        while st and steps < steps_max:
            cx, cy = st[-1]
            moved = False
            for dx, dy in shuffle(dirs):
                nx, ny = cx + dx, cy + dy
                if in_odd_grid(nx, ny) and cells[idx(w, nx, ny)] == WALL:
                    cells[idx(w, cx + dx // 2, cy + dy // 2)] = FLOOR
                    cells[idx(w, nx, ny)] = FLOOR
                    st.append((nx, ny))
                    moved = True
                    steps += 1
                    break
            if not moved:
                st.pop()

    for _ in range(carve_seeds):
        sx = 3 + rng.randint(max(1, (w - 6) // 2)) * 2
        sy = 3 + rng.randint(max(1, (h - 6) // 2)) * 2
        steps_max = int((w * h) * 0.008 * carve_step_mul)
        if in_odd_grid(sx, sy):
            walk(sx, sy, steps_max)


def keep_largest_region(cells: list[int], w: int, h: int) -> None:
    """Drop disconnected pockets. Unreachable floors are unwinnable layouts."""
    reg = [-1] * (w * h)
    rid = 0
    areas: list[int] = []
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            if cells[idx(w, x, y)] != FLOOR or reg[idx(w, x, y)] != -1:
                continue
            q = [(x, y)]
            reg[idx(w, x, y)] = rid
            area = 0
            while q:
                qx, qy = q.pop()
                area += 1
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = qx + dx, qy + dy
                    i = idx(w, nx, ny)
                    if 0 < nx < w - 1 and 0 < ny < h - 1 and cells[i] == FLOOR and reg[i] == -1:
                        reg[i] = rid
                        q.append((nx, ny))
            areas.append(area)
            rid += 1
    if not areas:
        return
    best = areas.index(max(areas))
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            if reg[idx(w, x, y)] != best:
                cells[idx(w, x, y)] = WALL


def erode_if_cramped(cells: list[int], w: int, h: int) -> None:
    """One CA pass if the map is still mostly rock after cull.

    Opens walls that already have three floor neighbors. Grows existing
    caves rather than punching random holes.
    """
    floors = sum(1 for c in cells if c == FLOOR)
    if floors >= (w * h) * MIN_FLOOR_RATIO:
        return
    for y in range(2, h - 2):
        for x in range(2, w - 2):
            if cells[idx(w, x, y)] != WALL:
                continue
            n = 0
            if cells[idx(w, x + 1, y)] == FLOOR:
                n += 1
            if cells[idx(w, x - 1, y)] == FLOOR:
                n += 1
            if cells[idx(w, x, y + 1)] == FLOOR:
                n += 1
            if cells[idx(w, x, y - 1)] == FLOOR:
                n += 1
            if n >= 3:
                cells[idx(w, x, y)] = FLOOR


def seal_border(cells: list[int], w: int, h: int) -> None:
    """Force the outer ring to wall so FOV and movement never leave the grid."""
    for x in range(w):
        cells[idx(w, x, 0)] = WALL
        cells[idx(w, x, h - 1)] = WALL
    for y in range(h):
        cells[idx(w, 0, y)] = WALL
        cells[idx(w, w - 1, y)] = WALL


def pack(cells: list[int]) -> str:
    return "".join("1" if c else "0" for c in cells)


def to_ascii(cells: list[int], w: int, h: int) -> str:
    rows = []
    for y in range(h):
        row = []
        for x in range(w):
            row.append("#" if cells[idx(w, x, y)] == WALL else ".")
        rows.append("".join(row))
    return "\n".join(rows)


def floor_regions(cells: list[int], w: int, h: int) -> int:
    seen = [False] * (w * h)
    count = 0
    for y in range(h):
        for x in range(w):
            i = idx(w, x, y)
            if cells[i] != FLOOR or seen[i]:
                continue
            count += 1
            q = [(x, y)]
            seen[i] = True
            while q:
                qx, qy = q.pop()
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = qx + dx, qy + dy
                    if not (0 <= nx < w and 0 <= ny < h):
                        continue
                    ni = idx(w, nx, ny)
                    if cells[ni] == FLOOR and not seen[ni]:
                        seen[ni] = True
                        q.append((nx, ny))
    return count


def validate(cells: list[int], w: int, h: int) -> list[str]:
    """Invariants a shipped map must keep. Empty list = ok."""
    errors: list[str] = []
    if len(cells) != w * h:
        errors.append(f"length {len(cells)} != {w}*{h}")
        return errors
    for x in range(w):
        if cells[idx(w, x, 0)] != WALL or cells[idx(w, x, h - 1)] != WALL:
            errors.append("open top/bottom border")
            break
    for y in range(h):
        if cells[idx(w, 0, y)] != WALL or cells[idx(w, w - 1, y)] != WALL:
            errors.append("open left/right border")
            break
    regions = floor_regions(cells, w, h)
    if regions != 1:
        errors.append(f"expected 1 floor region, got {regions}")
    return errors


def seed_for(level_index: int, layout_name: str, variant: int) -> int:
    return 1000 + level_index * 100 + (0 if layout_name == "landscape" else 50) + variant


def build_bank(variants: int) -> dict:
    levels: dict = {}
    for li, spec in enumerate(LEVELS):
        entry = {}
        for layout_name, size in LAYOUTS.items():
            maps = []
            for v in range(variants):
                seed = seed_for(li, layout_name, v)
                cells = generate(size["w"], size["h"], seed, spec["complexity"])
                maps.append({"seed": seed, "w": size["w"], "h": size["h"], "cells": pack(cells)})
            entry[layout_name] = maps
        levels[spec["key"]] = entry
    return {"version": 1, "layouts": LAYOUTS, "levels": levels}


def run_check(variants: int) -> int:
    failed = 0
    for li, spec in enumerate(LEVELS):
        for layout_name, size in LAYOUTS.items():
            for v in range(variants):
                seed = seed_for(li, layout_name, v)
                a = generate(size["w"], size["h"], seed, spec["complexity"])
                b = generate(size["w"], size["h"], seed, spec["complexity"])
                label = f"{spec['key']}/{layout_name}/seed={seed}"
                if a != b:
                    print(f"FAIL {label}: not deterministic")
                    failed += 1
                    continue
                errs = validate(a, size["w"], size["h"])
                if errs:
                    print(f"FAIL {label}: {'; '.join(errs)}")
                    failed += 1
    if failed:
        print(f"{failed} map(s) failed")
        return 1
    n = len(LEVELS) * len(LAYOUTS) * variants
    print(f"ok: {n} maps deterministic, sealed, single-region")
    return 0


def run_preview(level_key: str, layout_name: str, seed: int | None) -> int:
    spec = next((s for s in LEVELS if s["key"] == level_key), None)
    if spec is None:
        print(f"unknown level {level_key!r}", file=sys.stderr)
        return 2
    size = LAYOUTS.get(layout_name)
    if size is None:
        print(f"unknown layout {layout_name!r}", file=sys.stderr)
        return 2
    li = next(i for i, s in enumerate(LEVELS) if s["key"] == level_key)
    if seed is None:
        seed = seed_for(li, layout_name, 0)
    cells = generate(size["w"], size["h"], seed, spec["complexity"])
    print(f"# {level_key} {layout_name} {size['w']}x{size['h']} seed={seed}")
    print(to_ascii(cells, size["w"], size["h"]))
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Generate KOMMANDO map bank JSON")
    parser.add_argument("--variants", type=int, default=8, help="maps per level per layout")
    parser.add_argument("--out", type=Path, default=ROOT / "data" / "maps.json", help="output JSON path")
    parser.add_argument("--preview", action="store_true", help="print one cavern as ASCII and exit")
    parser.add_argument("--check", action="store_true", help="assert determinism + layout invariants")
    parser.add_argument("--level", default="jungle", help="preview level key")
    parser.add_argument("--layout", default="landscape", choices=sorted(LAYOUTS), help="preview layout")
    parser.add_argument("--seed", type=int, default=None, help="preview seed (default: bank seed 0)")
    args = parser.parse_args(argv)

    if args.check:
        return run_check(max(1, args.variants))
    if args.preview:
        return run_preview(args.level, args.layout, args.seed)

    bank = build_bank(max(1, args.variants))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(bank, separators=(",", ":")), encoding="utf-8")
    nmaps = sum(len(v) for level in bank["levels"].values() for v in level.values())
    print(f"Wrote {nmaps} maps -> {args.out} ({args.out.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
