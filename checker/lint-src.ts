import fs from "node:fs";
import path from "node:path";

export type Status = "PASS" | "FAIL" | "SKIP";

export type CheckResult = {
  id: string;
  family: string;
  status: Status;
  target: string;
  acceptable: string;
  measured: string;
  details: string;
};

const HEX = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b(?![0-9a-fA-F])/g;
const ARBITRARY_PX = /\[[0-9]+px\]/g;
const SOURCE_EXT = new Set([".ts", ".tsx", ".css"]);

function walk(dir: string, files: string[]) {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (SOURCE_EXT.has(path.extname(entry.name))) files.push(full);
  }
}

export function lintSrc(siteSrc: string | undefined): CheckResult[] {
  if (!siteSrc || siteSrc === "/path/to/site/source") {
    return [
      {
        id: "token-discipline",
        family: "token-discipline",
        status: "SKIP",
        target: "SITE_SRC",
        acceptable: "configured local source folder",
        measured: "unset",
        details: "SITE_SRC missing or still a placeholder",
      },
    ];
  }

  if (!fs.existsSync(siteSrc) || !fs.statSync(siteSrc).isDirectory()) {
    return [
      {
        id: "token-discipline",
        family: "token-discipline",
        status: "SKIP",
        target: "SITE_SRC",
        acceptable: "readable source directory",
        measured: "missing",
        details: "SITE_SRC is not a directory",
      },
    ];
  }

  const files: string[] = [];
  walk(siteSrc, files);
  const hits: CheckResult[] = [];

  for (const file of files) {
    const rel = path.relative(siteSrc, file);
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, i) => {
      const n = i + 1;
      for (const m of line.matchAll(HEX)) {
        hits.push({
          id: `token-hex-${rel}:${n}`,
          family: "token-discipline",
          status: "FAIL",
          target: `${rel}:${n}`,
          acceptable: "named tokens; no raw hex in UI source",
          measured: m[0],
          details: "hex color literal",
        });
      }
      for (const m of line.matchAll(ARBITRARY_PX)) {
        hits.push({
          id: `token-px-${rel}:${n}`,
          family: "token-discipline",
          status: "FAIL",
          target: `${rel}:${n}`,
          acceptable: "named rem tokens; no arbitrary px utilities",
          measured: m[0],
          details: "Tailwind arbitrary px utility",
        });
      }
    });
  }

  if (hits.length === 0) {
    return [
      {
        id: "token-discipline",
        family: "token-discipline",
        status: "PASS",
        target: `${files.length} source files`,
        acceptable: "no hex literals; no [Npx] utilities",
        measured: "0 hits",
        details: "crude v1 grep",
      },
    ];
  }

  return hits;
}
