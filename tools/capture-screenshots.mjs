import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(__dirname, "../docs/screenshots");
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.addInitScript(() => {
  try {
    localStorage.setItem("lims-demo-light-mode", "1");
  } catch {
    /* ignore */
  }
});

async function shot(name, prep) {
  await page.goto("http://localhost:3001/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(700);
  if (prep) await prep();
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(out, name), fullPage: false });
  console.log("wrote", name);
}

await shot("01-strain-registry.png");

await shot("02-pipeline-runs.png", async () => {
  await page.locator("aside nav button").filter({ hasText: "Pipeline runs" }).click();
});

await shot("03-pipeline-scenarios.png", async () => {
  await page.locator("aside nav button").filter({ hasText: "Pipeline scenarios" }).click();
  await page.waitForTimeout(2800);
});

await shot("04-projects.png", async () => {
  await page.locator("aside nav button").filter({ hasText: "Projects" }).click();
});

await shot("05-r-export.png", async () => {
  await page.locator("aside nav button").filter({ hasText: "R visuals" }).click();
});

await shot("06-dark-mode.png", async () => {
  const avatar = page.locator('button[aria-controls="lims-demo-settings"]');
  await avatar.click();
  await page.waitForTimeout(250);
  const checkbox = page.locator("#lims-demo-settings input[type=checkbox]").first();
  if (await checkbox.isChecked()) {
    await checkbox.click();
    await page.waitForTimeout(500);
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  await page.locator("aside nav button").filter({ hasText: "Strain registry" }).click();
  await page.waitForTimeout(500);
});

await browser.close();
console.log("done");
