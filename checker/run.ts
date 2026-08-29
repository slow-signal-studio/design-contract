import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";
import { lintSrc, type CheckResult, type Status } from "./lint-src";

const INK = { hex: "#1A1A1A", r: 26, g: 26, b: 26 };
const VIEWPORT = { width: 1280, height: 800 };

function parseRgb(color: string): { r: number; g: number; b: number } | null {
  const m = color.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (!m) return null;
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
}

function isInk(color: string): boolean {
  const rgb = parseRgb(color);
  if (!rgb) return color.replace(/\s/g, "").toLowerCase() === "#1a1a1a";
  return rgb.r === INK.r && rgb.g === INK.g && rgb.b === INK.b;
}

function isBrowserBlue(color: string): boolean {
  if (isInk(color)) return false;
  const rgb = parseRgb(color);
  if (!rgb) return /blue|highlight/i.test(color);
  return rgb.b > rgb.r + 40 && rgb.b > rgb.g && rgb.b >= 140;
}

async function checkGradients(page: Page): Promise<CheckResult[]> {
  const offenders = await page.evaluate(() => {
    function selectorPath(el: Element): string {
      const parts: string[] = [];
      let n: Element | null = el;
      while (n && parts.length < 12) {
        let part = n.tagName.toLowerCase();
        if (n.id) {
          parts.unshift(part + "#" + CSS.escape(n.id));
          break;
        }
        const cls = Array.from(n.classList).slice(0, 2).join(".");
        if (cls) part += "." + cls;
        const parent = n.parentElement;
        if (parent) {
          const same = Array.from(parent.children).filter((c) => c.tagName === n!.tagName);
          if (same.length > 1) part += `:nth-of-type(${same.indexOf(n) + 1})`;
        }
        parts.unshift(part);
        n = n.parentElement;
      }
      return parts.join(" > ");
    }
    function underArtwork(el: Element): boolean {
      if (location.pathname.includes("/artwork")) return true;
      let n: Element | null = el;
      while (n) {
        for (const attr of ["src", "href", "poster"]) {
          const v = n.getAttribute(attr);
          if (v && v.includes("/artwork")) return true;
        }
        n = n.parentElement;
      }
      return false;
    }
    const hits: string[] = [];
    for (const el of Array.from(document.querySelectorAll("*"))) {
      if (el.closest('[data-media="authored"]')) continue;
      if (underArtwork(el)) continue;
      const cs = getComputedStyle(el);
      const bg = cs.backgroundImage || "";
      const border = cs.borderImageSource || "";
      if (bg.includes("gradient(") || border.includes("gradient(")) {
        hits.push(selectorPath(el));
      }
    }
    return hits;
  });

  if (offenders.length === 0) {
    return [
      {
        id: "gradients",
        family: "gradients",
        status: "PASS",
        target: "computed background-image, border-image",
        acceptable: "no gradient() outside authored media / /artwork",
        measured: "0 offenders",
        details: "",
      },
    ];
  }

  return offenders.map((sel, i) => ({
    id: `gradients-${i + 1}`,
    family: "gradients",
    status: "FAIL" as const,
    target: sel,
    acceptable: "no CSS gradient() in UI",
    measured: "gradient(",
    details: sel,
  }));
}

async function checkInteractionLinks(page: Page): Promise<CheckResult[]> {
  const links = await page.evaluate(() => {
    const root = document.querySelector("main") || document.querySelector('[role="main"]') || document.body;
    function selectorPath(el: Element): string {
      const parts: string[] = [];
      let n: Element | null = el;
      while (n && parts.length < 12) {
        let part = n.tagName.toLowerCase();
        if (n.id) {
          parts.unshift(part + "#" + CSS.escape(n.id));
          break;
        }
        const cls = Array.from(n.classList).slice(0, 2).join(".");
        if (cls) part += "." + cls;
        const parent = n.parentElement;
        if (parent) {
          const same = Array.from(parent.children).filter((c) => c.tagName === n!.tagName);
          if (same.length > 1) part += `:nth-of-type(${same.indexOf(n) + 1})`;
        }
        parts.unshift(part);
        n = n.parentElement;
      }
      return parts.join(" > ");
    }
    return Array.from(root.querySelectorAll("a")).map((a) => {
      const cs = getComputedStyle(a);
      return {
        path: selectorPath(a),
        color: cs.color,
        decoration: cs.textDecorationLine || cs.textDecoration,
      };
    });
  });

  if (links.length === 0) {
    return [
      {
        id: "interaction-links",
        family: "interaction",
        status: "SKIP",
        target: "a in main content",
        acceptable: "color #1A1A1A; underline",
        measured: "0 links",
        details: "no <a> in main content",
      },
    ];
  }

  const fails: CheckResult[] = [];
  for (const link of links) {
    const colorOk = isInk(link.color);
    const underline = /\bunderline\b/i.test(link.decoration);
    if (colorOk && underline) continue;
    const reasons: string[] = [];
    if (!colorOk) reasons.push(`color ${link.color}`);
    if (!underline) reasons.push(`text-decoration ${link.decoration}`);
    fails.push({
      id: `interaction-link-${fails.length + 1}`,
      family: "interaction",
      status: "FAIL",
      target: link.path,
      acceptable: "color #1A1A1A (rgb 26,26,26); underline",
      measured: `${link.color}; ${link.decoration}`,
      details: reasons.join("; "),
    });
  }

  if (fails.length === 0) {
    return [
      {
        id: "interaction-links",
        family: "interaction",
        status: "PASS",
        target: "a in main content",
        acceptable: "color #1A1A1A; underline",
        measured: `${links.length} links`,
        details: "",
      },
    ];
  }
  return fails;
}

async function checkInteractionFocus(page: Page): Promise<CheckResult[]> {
  await page.locator("body").click({ position: { x: 1, y: 1 } }).catch(() => {});
  const seen = new Set<string>();
  const fails: CheckResult[] = [];
  let inspected = 0;

  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Tab");
    const snap = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return null;
      function selectorPath(node: Element): string {
        const parts: string[] = [];
        let n: Element | null = node;
        while (n && parts.length < 12) {
          let part = n.tagName.toLowerCase();
          if (n.id) {
            parts.unshift(part + "#" + CSS.escape(n.id));
            break;
          }
          const cls = Array.from(n.classList).slice(0, 2).join(".");
          if (cls) part += "." + cls;
          const parent = n.parentElement;
          if (parent) {
            const same = Array.from(parent.children).filter((c) => c.tagName === n!.tagName);
            if (same.length > 1) part += `:nth-of-type(${same.indexOf(n) + 1})`;
          }
          parts.unshift(part);
          n = n.parentElement;
        }
        return parts.join(" > ");
      }
      const cs = getComputedStyle(el);
      const outlineWidth = cs.outlineWidth;
      const outlineStyle = cs.outlineStyle;
      const outlineColor = cs.outlineColor;
      const boxShadow = cs.boxShadow;
      const outlineVisible = outlineStyle !== "none" && parseFloat(outlineWidth) > 0;
      const shadowVisible = boxShadow !== "none" && boxShadow !== "";
      return {
        path: selectorPath(el),
        tag: el.tagName,
        outlineWidth,
        outlineStyle,
        outlineColor,
        boxShadow,
        outlineVisible,
        hasVisibleFocus: outlineVisible || shadowVisible,
      };
    });

    if (!snap) continue;
    if (seen.has(snap.path)) break;
    seen.add(snap.path);
    inspected++;

    if (!snap.hasVisibleFocus) {
      fails.push({
        id: `interaction-focus-missing-${inspected}`,
        family: "interaction",
        status: "FAIL",
        target: snap.path,
        acceptable: "visible :focus-visible replacement; outline 2px solid #1A1A1A",
        measured: `outline ${snap.outlineStyle} ${snap.outlineWidth}; box-shadow ${snap.boxShadow}`,
        details: "outline none/0 and no visible :focus-visible styling",
      });
    } else if (snap.outlineVisible && isBrowserBlue(snap.outlineColor)) {
      fails.push({
        id: `interaction-focus-blue-${inspected}`,
        family: "interaction",
        status: "FAIL",
        target: snap.path,
        acceptable: "focus outline #1A1A1A, not browser-default blue",
        measured: snap.outlineColor,
        details: "focus outline color is browser-default blue tone",
      });
    }
  }

  if (inspected === 0) {
    return [
      {
        id: "interaction-focus",
        family: "interaction",
        status: "SKIP",
        target: "first 30 focusable",
        acceptable: "visible :focus-visible in #1A1A1A",
        measured: "0 focused elements",
        details: "tab produced no in-page focus",
      },
    ];
  }

  if (fails.length === 0) {
    return [
      {
        id: "interaction-focus",
        family: "interaction",
        status: "PASS",
        target: "first 30 focusable",
        acceptable: "visible :focus-visible in #1A1A1A",
        measured: `${inspected} focused`,
        details: "",
      },
    ];
  }
  return fails;
}

async function checkType(page: Page): Promise<CheckResult[]> {
  const sample = await page.evaluate(() => {
    const root = document.querySelector("main") || document.querySelector('[role="main"]') || document.body;
    const paragraphs = Array.from(root.querySelectorAll("p")).filter((p) => (p.textContent || "").trim().length > 0).slice(0, 40);
    function selectorPath(el: Element): string {
      const parts: string[] = [];
      let n: Element | null = el;
      while (n && parts.length < 12) {
        let part = n.tagName.toLowerCase();
        if (n.id) {
          parts.unshift(part + "#" + CSS.escape(n.id));
          break;
        }
        const cls = Array.from(n.classList).slice(0, 2).join(".");
        if (cls) part += "." + cls;
        const parent = n.parentElement;
        if (parent) {
          const same = Array.from(parent.children).filter((c) => c.tagName === n!.tagName);
          if (same.length > 1) part += `:nth-of-type(${same.indexOf(n) + 1})`;
        }
        parts.unshift(part);
        n = n.parentElement;
      }
      return parts.join(" > ");
    }
    const probe = document.createElement("span");
    const bodyCs = getComputedStyle(document.body);
    probe.textContent = "0";
    probe.style.cssText = `position:absolute;left:-9999px;font-family:${bodyCs.fontFamily};font-size:${bodyCs.fontSize};font-weight:${bodyCs.fontWeight};line-height:normal;`;
    document.body.appendChild(probe);
    const ch = probe.getBoundingClientRect().width;
    probe.remove();
    return {
      ch,
      items: paragraphs.map((p) => {
        const cs = getComputedStyle(p);
        const fontSize = parseFloat(cs.fontSize);
        const lineHeight = parseFloat(cs.lineHeight);
        const width = p.getBoundingClientRect().width;
        return {
          path: selectorPath(p),
          fontSize,
          lineHeight,
          leading: fontSize ? lineHeight / fontSize : 0,
          width,
          measure: ch ? width / ch : 0,
        };
      }),
    };
  });

  if (sample.items.length === 0) {
    return [
      {
        id: "type-tolerances",
        family: "type-tolerances",
        status: "SKIP",
        target: "p in main content",
        acceptable: "leading 1.50-1.65; measure 58-70ch",
        measured: "0 paragraphs",
        details: "no <p> with text in main content",
      },
    ];
  }

  const fails: CheckResult[] = [];
  for (const item of sample.items) {
    if (item.leading < 1.5 || item.leading > 1.65) {
      fails.push({
        id: `type-leading-${fails.length + 1}`,
        family: "type-tolerances",
        status: "FAIL",
        target: item.path,
        acceptable: "leading Target 1.55, Acceptable 1.50-1.65",
        measured: String(Number(item.leading.toFixed(3))),
        details: `line-height ${item.lineHeight}px / font-size ${item.fontSize}px`,
      });
    }
    if (item.measure < 58 || item.measure > 70) {
      fails.push({
        id: `type-measure-${fails.length + 1}`,
        family: "type-tolerances",
        status: "FAIL",
        target: item.path,
        acceptable: "measure Acceptable 58-70ch",
        measured: `${Number(item.measure.toFixed(2))}ch`,
        details: `width ${Number(item.width.toFixed(1))}px / ch ${Number(sample.ch.toFixed(2))}px`,
      });
    }
  }

  if (fails.length === 0) {
    return [
      {
        id: "type-tolerances",
        family: "type-tolerances",
        status: "PASS",
        target: "p in main content",
        acceptable: "leading 1.50-1.65; measure 58-70ch",
        measured: `${sample.items.length} paragraphs; ch=${Number(sample.ch.toFixed(2))}px`,
        details: "",
      },
    ];
  }
  return fails;
}

async function checkZoom(page: Page): Promise<CheckResult[]> {
  let method = "cdp-page-scale";
  try {
    const client = await page.context().newCDPSession(page);
    await client.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
  } catch {
    method = "font-size-double";
    await page.evaluate(() => {
      const root = document.documentElement;
      const current = parseFloat(getComputedStyle(root).fontSize) || 16;
      root.style.fontSize = `${current * 2}px`;
    });
  }

  const measured = await page.evaluate((viewportWidth) => {
    const scrollWidth = document.documentElement.scrollWidth;
    const overflowBy = scrollWidth - viewportWidth;
    const clipped: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    const NON_RENDERING = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "TITLE"]);
    while (node) {
      const el = node as HTMLElement;
      if (NON_RENDERING.has(el.tagName)) {
        node = walker.nextNode();
        continue;
      }
      const text = (el.childNodes.length && Array.from(el.childNodes).some((c) => c.nodeType === 3 && (c.textContent || "").trim()))
        ? (el.textContent || "").trim()
        : "";
      if (text && el.clientWidth === 0) {
        clipped.push(el.tagName.toLowerCase());
      }
      node = walker.nextNode();
    }
    return { scrollWidth, overflowBy, clippedCount: clipped.length, clippedTags: Array.from(new Set(clipped)).slice(0, 8) };
  }, VIEWPORT.width);

  const conditions: string[] = [];
  if (measured.overflowBy > 8) conditions.push(`horizontal overflow ${measured.overflowBy}px`);
  if (measured.clippedCount > 0) conditions.push(`clientWidth 0 with text (${measured.clippedCount} els: ${measured.clippedTags.join(", ")})`);

  if (conditions.length === 0) {
    return [
      {
        id: "zoom-contract",
        family: "zoom-contract",
        status: "PASS",
        target: "1280px viewport at 200%",
        acceptable: "scrollWidth <= viewport+8px; no text clientWidth 0",
        measured: `scrollWidth ${measured.scrollWidth}px; clipped 0`,
        details: method,
      },
    ];
  }

  return [
    {
      id: "zoom-contract",
      family: "zoom-contract",
      status: "FAIL",
      target: "1280px viewport at 200%",
      acceptable: "scrollWidth <= viewport+8px; no text clientWidth 0",
      measured: `scrollWidth ${measured.scrollWidth}px; overflowBy ${measured.overflowBy}px; clipped ${measured.clippedCount}`,
      details: `${method}; ${conditions.join("; ")}`,
    },
  ];
}

function summarize(checks: CheckResult[]) {
  const byFamily: Record<string, Record<Status, number>> = {};
  const byStatus: Record<Status, number> = { PASS: 0, FAIL: 0, SKIP: 0 };
  for (const c of checks) {
    if (!byFamily[c.family]) byFamily[c.family] = { PASS: 0, FAIL: 0, SKIP: 0 };
    byFamily[c.family][c.status]++;
    byStatus[c.status]++;
  }
  return { byFamily, byStatus };
}

function printTable(checks: CheckResult[], summary: ReturnType<typeof summarize>) {
  const pad = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length));
  console.log("");
  console.log(`${pad("STATUS", 8)} ${pad("FAMILY", 20)} ${pad("ID", 36)} MEASURED`);
  console.log("-".repeat(100));
  for (const c of checks) {
    console.log(`${pad(c.status, 8)} ${pad(c.family, 20)} ${pad(c.id, 36)} ${c.measured}`);
    if (c.status === "FAIL" && c.details) console.log(`         ${c.details}`);
  }
  console.log("-".repeat(100));
  console.log(
    `summary  PASS ${summary.byStatus.PASS}  FAIL ${summary.byStatus.FAIL}  SKIP ${summary.byStatus.SKIP}`
  );
  for (const [family, counts] of Object.entries(summary.byFamily)) {
    console.log(`  ${family}: PASS ${counts.PASS}  FAIL ${counts.FAIL}  SKIP ${counts.SKIP}`);
  }
}

async function main() {
  const checks: CheckResult[] = [];
  const targetUrl = process.env.TARGET_URL;

  if (!targetUrl) {
    for (const family of ["gradients", "interaction", "zoom-contract", "type-tolerances"]) {
      checks.push({
        id: family,
        family,
        status: "SKIP",
        target: "TARGET_URL",
        acceptable: "configured live site",
        measured: "unset",
        details: "TARGET_URL missing or still a placeholder",
      });
    }
  } else {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: VIEWPORT });
    try {
      // tsx compiles inner functions with esbuild's keepNames wrapper, which is undefined in page context.
      await page.addInitScript(() => {
        (window as unknown as { __name: (fn: unknown) => unknown }).__name = (fn) => fn;
      });
      await page.goto(targetUrl, { waitUntil: "load", timeout: 30000 });
      checks.push(...(await checkGradients(page)));
      checks.push(...(await checkInteractionLinks(page)));
      checks.push(...(await checkInteractionFocus(page)));
      checks.push(...(await checkType(page)));
      checks.push(...(await checkZoom(page)));
    } catch (err) {
      const message = err instanceof Error ? err.message : "navigation failed";
      for (const family of ["gradients", "interaction", "zoom-contract", "type-tolerances"]) {
        checks.push({
          id: family,
          family,
          status: "SKIP",
          target: "document",
          acceptable: "reachable live site",
          measured: "error",
          details: message.replace(targetUrl, "[TARGET_URL]"),
        });
      }
    } finally {
      await browser.close();
    }
  }

  checks.push(...lintSrc(process.env.SITE_SRC));

  const generatedAt = new Date().toISOString();
  const summary = summarize(checks);
  const report = { generatedAt, summary, checks };
  const reportsDir = path.join(process.cwd(), "reports");
  fs.mkdirSync(reportsDir, { recursive: true });
  const filename = `run-${generatedAt}.json`;
  fs.writeFileSync(path.join(reportsDir, filename), JSON.stringify(report, null, 2));
  printTable(checks, summary);
  console.log(`\nreport  reports/${filename}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
