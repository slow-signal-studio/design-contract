import "dotenv/config";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";

const VIEWPORT = { width: 1280, height: 800 };
const DEVICE_SCALE_FACTOR = 2;
const DEMO_ORIGIN = "https://loop-visibility.vercel.app";
const DEMO_PATH = "/run";

type TargetId = "timeline-v1" | "demo-v1";

type Target = {
  id: TargetId;
  url: string;
  outDir: string;
};

function outDirFor(id: TargetId): string {
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

function onlyArg(): TargetId | null {
  const flag = process.argv.find((a) => a.startsWith("--only="));
  if (!flag) return null;
  const value = flag.slice("--only=".length);
  if (value === "timeline-v1" || value === "demo-v1") return value;
  throw new Error(`unknown --only target: ${value}`);
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

async function bodyText(page: Page): Promise<string> {
  return page.locator("body").innerText();
}

function isEmptyDemo(text: string): boolean {
  return /no trace rows yet/i.test(text);
}

function isRunningDemo(text: string): boolean {
  return /running/i.test(text) && !isEmptyDemo(text);
}

function isCompleteDemo(text: string): boolean {
  return !/running/i.test(text) && !isEmptyDemo(text);
}

async function waitForDemo(page: Page, pred: (text: string) => boolean, label: string, timeoutMs: number): Promise<string> {
  const start = Date.now();
  let last = "";
  while (Date.now() - start < timeoutMs) {
    last = await bodyText(page);
    if (pred(last)) return last;
    await delay(1000);
  }
  throw new Error(`timed out waiting for ${label}: ${last.replace(/\s+/g, " ").trim().slice(0, 240)}`);
}

async function startDemoRun(page: Page) {
  const button = page.getByRole("button", { name: /run money check-in/i });
  await button.click();
  console.log("  started money check-in");
}

function wipePngs(outDir: string) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const name of fs.readdirSync(outDir)) {
    if (name.endsWith(".png")) fs.unlinkSync(path.join(outDir, name));
  }
}

type Layout = {
  scrollHeight: number;
  clientHeight: number;
};

async function pageLayout(page: Page): Promise<Layout> {
  return page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    return {
      scrollHeight: Math.max(html.scrollHeight, body.scrollHeight),
      clientHeight: html.clientHeight,
    };
  });
}

async function scrollToY(page: Page, top: number) {
  await page.evaluate((t) => window.scrollTo(0, t), top);
}

async function expandVerifyOnly(page: Page) {
  const verify = page.getByRole("button", { name: /^Verify/i }).first();
  await verify.click();
  await delay(400);
}

async function captureExpandedVerify(page: Page, outDir: string) {
  await expandVerifyOnly(page);
  const { scrollHeight, clientHeight } = await pageLayout(page);
  console.log(`  expanded-verify layout ${scrollHeight}x${clientHeight}`);

  if (scrollHeight > clientHeight) {
    await scrollToY(page, 0);
    await delay(200);
    console.log("  expanded-verify-full.png");
    await page.screenshot({
      path: path.join(outDir, "expanded-verify-full.png"),
      fullPage: true,
      timeout: 60000,
    });
  }

  await page.getByRole("button", { name: /^Verify/i }).first().scrollIntoViewIfNeeded();
  await delay(200);
  console.log("  expanded-verify.png");
  await page.screenshot({
    path: path.join(outDir, "expanded-verify.png"),
    fullPage: false,
    timeout: 30000,
  });
  await scrollToY(page, 0);
}

async function captureShots(page: Page, outDir: string, prefix: string) {
  fs.mkdirSync(outDir, { recursive: true });
  await settle(page);
  await scrollToY(page, 0);
  await delay(200);

  const fullName = `${prefix}full.png`;
  console.log(`  ${fullName}`);
  await page.screenshot({
    path: path.join(outDir, fullName),
    fullPage: true,
    timeout: 60000,
  });

  const { scrollHeight, clientHeight } = await pageLayout(page);
  const step = Math.max(clientHeight, VIEWPORT.height);
  const maxY = Math.max(0, scrollHeight - clientHeight);
  console.log(`  layout ${scrollHeight}x${clientHeight} prefix=${prefix || "(completed)"}`);

  let index = 1;
  let y = 0;
  while (true) {
    const top = Math.min(y, maxY);
    await scrollToY(page, top);
    await delay(200);
    const num = String(index).padStart(2, "0");
    const name = `${prefix}section-${num}.png`;
    console.log(`  ${name} @ ${top}`);
    await page.screenshot({
      path: path.join(outDir, name),
      fullPage: false,
      timeout: 30000,
    });
    if (top >= maxY) break;
    y += step;
    index += 1;
    if (index > 50) break;
  }

  await scrollToY(page, 0);
}

async function captureTimeline(page: Page, target: Target) {
  wipePngs(target.outDir);
  console.log("  goto");
  await page.goto(target.url, { waitUntil: "load", timeout: 45000 });
  await settle(page);
  await scrollThrough(page);
  await captureShots(page, target.outDir, "");
}

async function scrollThrough(page: Page) {
  const { scrollHeight, clientHeight } = await pageLayout(page);
  const step = Math.max(clientHeight, 1);
  const maxY = Math.max(0, scrollHeight - clientHeight);
  let y = 0;
  let n = 0;
  while (y < maxY && n < 50) {
    y = Math.min(y + step, maxY);
    await scrollToY(page, y);
    await delay(150);
    n += 1;
  }
  await scrollToY(page, 0);
  await delay(200);
}

async function captureDemo(page: Page, target: Target) {
  wipePngs(target.outDir);
  console.log("  goto");
  await page.goto(target.url, { waitUntil: "load", timeout: 45000 });
  await settle(page);
  await startDemoRun(page);
  const running = await waitForDemo(page, isRunningDemo, "in-progress trace", 60000);
  console.log(`  running: ${running.replace(/\s+/g, " ").trim().slice(0, 180)}`);
  await delay(800);
  await captureShots(page, target.outDir, "running-");
  const complete = await waitForDemo(page, isCompleteDemo, "completed trace", 180000);
  console.log(`  complete: ${complete.replace(/\s+/g, " ").trim().slice(0, 180)}`);
  await delay(800);
  await captureShots(page, target.outDir, "");
  await captureExpandedVerify(page, target.outDir);
}

async function main() {
  const only = onlyArg();
  const all: Target[] = [
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
  const targets = only ? all.filter((t) => t.id === only) : all;

  const commit = siteCommit(process.env.SITE_SRC);
  console.log(`demo path: ${DEMO_PATH} (hop-trace UI; / is fleet overview)`);
  console.log(`site commit: ${commit ? `${commit.hash} ${commit.subject}` : "unavailable"}`);
  if (only) console.log(`only: ${only}`);

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
      if (target.id === "demo-v1") await captureDemo(page, target);
      else await captureTimeline(page, target);
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
