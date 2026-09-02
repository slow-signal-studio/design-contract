import "dotenv/config";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";

const VIEWPORT = { width: 1280, height: 800 };
const DEVICE_SCALE_FACTOR = 2;
const DEMO_ORIGIN = "https://loop-visibility.vercel.app";
const DEMO_PATH = "/run";

type Target = {
  id: "timeline-v1" | "demo-v1";
  url: string;
  outDir: string;
};

function outDirFor(id: Target["id"]): string {
  return path.join(process.cwd(), "anchors", id);
}

function timelineUrl(): string {
  const raw = process.env.TARGET_URL;
  if (!raw) {
    throw new Error("TARGET_URL is not set");
  }
  return new URL("/", raw).href;
}

function siteCommit(siteSrc: string | undefined): { hash: string; subject: string } | null {
  if (!siteSrc || siteSrc === "/path/to/site/source" || !fs.existsSync(siteSrc)) return null;
  try {
    const hash = execFileSync("git", ["log", "-1", "--format=%H"], { cwd: siteSrc, encoding: "utf8" }).trim();
    const subject = execFileSync("git", ["log", "-1", "--format=%s"], { cwd: siteSrc, encoding: "utf8" }).trim();
    return { hash, subject };
  } catch {
    return null;
  }
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.evaluate(async () => {
    await Promise.race([
      document.fonts.ready,
      new Promise<void>((resolve) => setTimeout(resolve, 5000)),
    ]);
    const imgs = Array.from(document.images);
    await Promise.race([
      Promise.all(
        imgs.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.addEventListener("load", () => resolve(), { once: true });
                img.addEventListener("error", () => resolve(), { once: true });
              })
        )
      ),
      new Promise<void>((resolve) => setTimeout(resolve, 8000)),
    ]);
  });
  await delay(400);
}

async function scrollThrough(page: Page) {
  const { scrollHeight, clientHeight } = await page.evaluate(() => ({
    scrollHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
    clientHeight: document.documentElement.clientHeight,
  }));
  const step = Math.max(clientHeight, 1);
  const maxY = Math.max(0, scrollHeight - clientHeight);
  let y = 0;
  let n = 0;
  while (y < maxY && n < 50) {
    y = Math.min(y + step, maxY);
    await page.evaluate((t) => window.scrollTo(0, t), y);
    await delay(150);
    n += 1;
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await delay(200);
}

async function captureTarget(page: Page, target: Target) {
  fs.mkdirSync(target.outDir, { recursive: true });
  for (const name of fs.readdirSync(target.outDir)) {
    if (name.endsWith(".png")) fs.unlinkSync(path.join(target.outDir, name));
  }

  console.log(`  goto`);
  await page.goto(target.url, { waitUntil: "load", timeout: 45000 });
  await settle(page);
  const metrics = await page.evaluate(() => ({
    scrollHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
    clientHeight: document.documentElement.clientHeight,
  }));
  console.log(`  layout ${metrics.scrollHeight}x${metrics.clientHeight}`);
  await scrollThrough(page);
  await settle(page);

  console.log(`  full.png`);
  await page.screenshot({
    path: path.join(target.outDir, "full.png"),
    fullPage: true,
    timeout: 60000,
  });

  const { scrollHeight, clientHeight } = await page.evaluate(() => ({
    scrollHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
    clientHeight: document.documentElement.clientHeight,
  }));
  const step = Math.max(clientHeight, VIEWPORT.height);
  const maxY = Math.max(0, scrollHeight - clientHeight);

  let index = 1;
  let y = 0;
  while (true) {
    const top = Math.min(y, maxY);
    await page.evaluate((t) => window.scrollTo(0, t), top);
    await delay(200);
    const num = String(index).padStart(2, "0");
    console.log(`  section-${num}.png @ ${top}`);
    await page.screenshot({
      path: path.join(target.outDir, `section-${num}.png`),
      fullPage: false,
      timeout: 30000,
    });
    if (top >= maxY) break;
    y += step;
    index += 1;
    if (index > 50) break;
  }

  await page.evaluate(() => window.scrollTo(0, 0));
}

async function main() {
  const targets: Target[] = [
    {
      id: "timeline-v1",
      url: timelineUrl(),
      outDir: outDirFor("timeline-v1"),
    },
    {
      id: "demo-v1",
      url: `${DEMO_ORIGIN}${DEMO_PATH}`,
      outDir: outDirFor("demo-v1"),
    },
  ];

  const commit = siteCommit(process.env.SITE_SRC);
  console.log(`demo path: ${DEMO_PATH} (hop-trace UI; / is fleet overview)`);
  console.log(`site commit: ${commit ? `${commit.hash} ${commit.subject}` : "unavailable"}`);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    (window as unknown as { __name: (fn: unknown) => unknown }).__name = (fn) => fn;
  });

  try {
    for (const target of targets) {
      console.log(`capturing ${target.id}`);
      await captureTarget(page, target);
      const files = fs.readdirSync(target.outDir).filter((f) => f.endsWith(".png")).sort();
      console.log(`  ${files.length} pngs: ${files.join(", ")}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
