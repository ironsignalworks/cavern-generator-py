"""Render the intro ASCII skull into favicon.ico / favicon.png."""
from __future__ import annotations

import ast
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
INK = (0x55, 0xFF, 0x55, 255)
BG = (0, 0, 0, 255)

WEIGHTS = {
    "█": 1.00,
    "▓": 0.78,
    "▒": 0.48,
    "░": 0.24,
}


def load_skull_lines() -> list[str]:
    raw = (ROOT / "js" / "ascii.js").read_text(encoding="utf-8")
    marker = "export const SKULL_ASCII ="
    start = raw.find(marker)
    if start < 0:
        raise SystemExit("SKULL_ASCII not found in js/ascii.js")
    stmt = raw[start + len(marker) :].split(";", 1)[0].strip()
    art = ast.literal_eval(stmt)
    return art.split("\n")


def rasterize(lines: list[str], cell: int = 8) -> Image.Image:
    rows = len(lines)
    cols = max(len(line) for line in lines)
    img = Image.new("RGBA", (cols * cell, rows * cell), (0, 0, 0, 0))
    px = img.load()
    for y, line in enumerate(lines):
        for x, ch in enumerate(line):
            w = WEIGHTS.get(ch)
            if not w:
                continue
            a = int(round(255 * w))
            color = (INK[0], INK[1], INK[2], a)
            for dy in range(cell):
                for dx in range(cell):
                    px[x * cell + dx, y * cell + dy] = color
    return img


def crop_content(img: Image.Image, pad_ratio: float = 0.08) -> Image.Image:
    alpha = img.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        return img
    cropped = img.crop(bbox)
    # Drop the thin trailing spine so the skull face fills a square favicon.
    cut = int(cropped.height * 0.18)
    if cut > 0:
        cropped = cropped.crop((0, 0, cropped.width, cropped.height - cut))
    side = int(max(cropped.size) * (1 + pad_ratio * 2))
    square = Image.new("RGBA", (side, side), BG)
    ox = (side - cropped.width) // 2
    oy = (side - cropped.height) // 2
    square.paste(cropped, (ox, oy), cropped)
    # Composite onto opaque black for ICO compatibility.
    out = Image.new("RGBA", (side, side), BG)
    out.alpha_composite(square)
    return out


def main() -> None:
    skull = crop_content(rasterize(load_skull_lines(), cell=8))
    sizes = [(16, 16), (32, 32), (48, 48)]
    skull.save(ROOT / "favicon.ico", format="ICO", sizes=sizes)
    skull.resize((32, 32), Image.Resampling.LANCZOS).save(ROOT / "favicon.png", format="PNG")
    skull.resize((180, 180), Image.Resampling.LANCZOS).save(ROOT / "apple-touch-icon.png", format="PNG")
    print("wrote favicon.ico, favicon.png, apple-touch-icon.png")


if __name__ == "__main__":
    main()
