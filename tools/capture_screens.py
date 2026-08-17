"""Capture README screenshots. Requires a local static server on PORT."""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SHOTS = ROOT / "screenshots"
SHOTS.mkdir(exist_ok=True)
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
BASE = f"http://127.0.0.1:{PORT}"
VIEW = {"width": 1100, "height": 720}


def settle(page, ms=400):
    page.wait_for_timeout(ms)
    page.evaluate("() => document.fonts && document.fonts.ready")
    page.wait_for_timeout(200)


def skip_typewriters(page):
    # parseInt('0') is falsy in the page scripts, so they fall back to 24ms
    page.add_init_script(
        """
        document.documentElement.style.setProperty('--type-ms', '1');
        document.documentElement.style.setProperty('--reveal-ms', '80');
        """
    )


def wait_typewriter(page):
    page.wait_for_function(
        """() => {
          const blocks = [...document.querySelectorAll('[data-type]')]
            .filter(el => el.offsetParent !== null);
          return blocks.length > 0 && blocks.every(el => {
            const t = (el.textContent || '').trim();
            return t.length > 40 && !t.endsWith('_');
          });
        }""",
        timeout=20000,
    )


def shot(page, name):
    path = SHOTS / name
    page.screenshot(path=str(path), type="png")
    print("wrote", path)


def wanted(name):
    extra = [a.lower() for a in sys.argv[2:]]
    return not extra or name in extra


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport=VIEW, device_scale_factor=1)

        if wanted("intro"):
            page.goto(f"{BASE}/index.html", wait_until="networkidle")
            page.wait_for_selector("#startBtn")
            page.wait_for_timeout(12000)
            settle(page, 600)
            shot(page, "intro.png")

        skip_typewriters(page)

        if wanted("briefing"):
            page.goto(f"{BASE}/deployment.html", wait_until="networkidle")
            page.wait_for_selector(".dos-shell")
            wait_typewriter(page)
            settle(page, 500)
            shot(page, "briefing.png")

        if wanted("extract"):
            page.goto(f"{BASE}/endgame.html?outcome=extract", wait_until="networkidle")
            page.wait_for_selector(".dos-shell")
            wait_typewriter(page)
            settle(page, 500)
            shot(page, "extract.png")

        need_play = wanted("descend") or wanted("play") or wanted("help")
        if need_play:
            page = browser.new_page(viewport=VIEW, device_scale_factor=1)
            page.goto(f"{BASE}/play.html", wait_until="networkidle")
            page.wait_for_selector("#btnStartGame")
            settle(page, 800)
            if wanted("descend"):
                shot(page, "descend.png")

            if wanted("play") or wanted("help"):
                page.click("#btnStartGame")
                page.wait_for_function(
                    """() => {
                      const c = document.getElementById('screen');
                      return !!(c && window.game && window.SPR && Object.keys(window.SPR).length);
                    }"""
                )
                page.wait_for_timeout(900)
                settle(page)
                if wanted("play"):
                    shot(page, "play.png")

                if wanted("help"):
                    page.click("#btnInstructions")
                    page.wait_for_selector("#instructionsModal:not(.hidden)")
                    page.wait_for_timeout(400)
                    settle(page)
                    shot(page, "help.png")

        browser.close()


if __name__ == "__main__":
    main()
