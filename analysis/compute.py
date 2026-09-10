"""Agreement, kappa, position-bias, H2/H4. Aggregates only; --full sealed until after session B."""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

EXPECTED_CWD = Path("/Users/elliottroya/code/slowsignal/design-contract")
CLAUSES = [
    "density",
    "hierarchy",
    "restraint",
    "earned-convention",
    "rubric Q1",
    "rubric Q2",
    "rubric Q4",
]
JUDGES = ["J-contract", "J-generic"]
LABELS = ["yes", "partial", "no"]
TARGET_N = 63
PASSING = {"pass", "pass with notes"}


def assert_cwd() -> Path:
    cwd = Path.cwd().resolve()
    if cwd != EXPECTED_CWD:
        print(f"refusing: cwd is {cwd}", file=sys.stderr)
        sys.exit(1)
    return cwd


def load_jsonl(path: Path) -> list[dict]:
    rows = []
    if not path.exists():
        return rows
    for line in path.read_text().splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


def load_human(root: Path) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for row in load_jsonl(root / "variants/meta/roya-verdicts.jsonl"):
        vid = row.get("variantId")
        if not vid:
            continue
        clauses = {c["name"]: c["verdict"] for c in row.get("clauses", [])}
        out[vid] = {"clauses": clauses, "overall": row.get("overall")}
    return out


def load_judges(root: Path) -> dict[tuple[str, str, int], dict]:
    out: dict[tuple[str, str, int], dict] = {}
    for row in load_jsonl(root / "variants/meta/judge-results.jsonl"):
        if row.get("judge_miss") or row.get("status") not in (None, "ok"):
            continue
        vid = row.get("variant_id")
        judge = row.get("judge")
        pas = row.get("pass")
        clauses = row.get("clauses") or {}
        if vid is None or judge is None or pas not in (0, 1):
            continue
        parsed = {}
        for name, cell in clauses.items():
            if not isinstance(cell, dict):
                continue
            score = cell.get("score")
            if score not in LABELS:
                continue
            conf = cell.get("confidence")
            try:
                conf_f = float(conf)
            except (TypeError, ValueError):
                conf_f = float("nan")
            parsed[name] = {"score": score, "confidence": conf_f}
        if parsed:
            out[(vid, judge, int(pas))] = parsed
    return out


def load_conditions(root: Path) -> dict[str, str]:
    raw = json.loads((root / "variants/meta/manifest.json").read_text())
    cond = {}
    for key, val in raw.items():
        if not (key.startswith("V") and isinstance(val, dict) and "condition" in val):
            continue
        c = val["condition"]
        if c in ("C", "N"):
            cond[key] = c
    return cond


def cohen_kappa(human: list[str], judge: list[str]) -> float:
    n = len(human)
    if n == 0:
        return float("nan")
    idx = {lab: i for i, lab in enumerate(LABELS)}
    m = np.zeros((3, 3), dtype=float)
    for h, j in zip(human, judge):
        if h not in idx or j not in idx:
            continue
        m[idx[h], idx[j]] += 1
    total = m.sum()
    if total == 0:
        return float("nan")
    po = float(np.trace(m) / total)
    pe = float((m.sum(axis=1) / total) @ (m.sum(axis=0) / total))
    if pe >= 1.0:
        return 1.0 if po >= 1.0 else float("nan")
    return (po - pe) / (1.0 - pe)


def pabak(human: list[str], judge: list[str], k: int = 3) -> float:
    """Prevalence-adjusted bias-adjusted kappa (Brennan–Prediger; k categories)."""
    n = len(human)
    if n == 0:
        return float("nan")
    po = sum(h == j for h, j in zip(human, judge)) / n
    return (k * po - 1.0) / (k - 1.0)


@dataclass
class ClauseRow:
    clause: str
    judge: str
    n: int
    n_agree: int
    agreement: float
    kappa: float
    pabak: float
    pos_bias: float
    n_bias: int
    conf_agree: float
    conf_dis: float
    n_conf_agree: int
    n_conf_dis: int


def compute(human: dict, judges: dict, conditions: dict) -> dict:
    n = len(human)
    rows: list[ClauseRow] = []
    for clause in CLAUSES:
        for judge in JUDGES:
            h_labs: list[str] = []
            j_labs: list[str] = []
            conf_ag: list[float] = []
            conf_dis: list[float] = []
            bias_n = 0
            bias_chg = 0
            for vid, hv in human.items():
                h = hv["clauses"].get(clause)
                if h not in LABELS:
                    continue
                p0 = judges.get((vid, judge, 0))
                p1 = judges.get((vid, judge, 1))
                if p0 and p1 and clause in p0 and clause in p1:
                    bias_n += 1
                    if p0[clause]["score"] != p1[clause]["score"]:
                        bias_chg += 1
                chosen = p0 or p1
                if not chosen or clause not in chosen:
                    continue
                j = chosen[clause]["score"]
                if j not in LABELS:
                    continue
                h_labs.append(h)
                j_labs.append(j)
                conf = chosen[clause]["confidence"]
                if h == j:
                    if np.isfinite(conf):
                        conf_ag.append(conf)
                else:
                    if np.isfinite(conf):
                        conf_dis.append(conf)
            n_pair = len(h_labs)
            n_ag = sum(h == j for h, j in zip(h_labs, j_labs))
            rows.append(
                ClauseRow(
                    clause=clause,
                    judge=judge,
                    n=n_pair,
                    n_agree=n_ag,
                    agreement=(n_ag / n_pair) if n_pair else float("nan"),
                    kappa=cohen_kappa(h_labs, j_labs),
                    pabak=pabak(h_labs, j_labs),
                    pos_bias=(bias_chg / bias_n) if bias_n else float("nan"),
                    n_bias=bias_n,
                    conf_agree=float(np.mean(conf_ag)) if conf_ag else float("nan"),
                    conf_dis=float(np.mean(conf_dis)) if conf_dis else float("nan"),
                    n_conf_agree=len(conf_ag),
                    n_conf_dis=len(conf_dis),
                )
            )

    by_judge = defaultdict(list)
    for r in rows:
        by_judge[r.judge].append(r.agreement)
    mean_c = float(np.nanmean(by_judge["J-contract"])) if by_judge["J-contract"] else float("nan")
    mean_g = float(np.nanmean(by_judge["J-generic"])) if by_judge["J-generic"] else float("nan")
    h2 = mean_c - mean_g

    h4 = {"C": {"n": 0, "pass": 0}, "N": {"n": 0, "pass": 0}}
    overall_counts = defaultdict(int)
    for vid, hv in human.items():
        cond = conditions.get(vid)
        overall_counts[hv["overall"]] += 1
        if cond not in h4:
            continue
        h4[cond]["n"] += 1
        if hv["overall"] in PASSING:
            h4[cond]["pass"] += 1

    def rate(side: str) -> float:
        nn = h4[side]["n"]
        return (h4[side]["pass"] / nn) if nn else float("nan")

    return {
        "n_human": n,
        "n_target": TARGET_N,
        "rows": rows,
        "h2": h2,
        "h2_contract": mean_c,
        "h2_generic": mean_g,
        "h4": h4,
        "h4_rate_C": rate("C"),
        "h4_rate_N": rate("N"),
        "h4_delta": rate("C") - rate("N"),
        "overall_counts": dict(overall_counts),
    }


def fmt(x: float, digits: int = 3) -> str:
    if x is None or (isinstance(x, float) and not np.isfinite(x)):
        return "  n/a"
    return f"{x:.{digits}f}"


def table_df(result: dict) -> pd.DataFrame:
    recs = []
    for r in result["rows"]:
        recs.append(
            {
                "clause": r.clause,
                "judge": r.judge,
                "N": r.n,
                "agree": r.agreement,
                "kappa": r.kappa,
                "pabak": r.pabak,
                "pos_bias": r.pos_bias,
                "conf_agree": r.conf_agree,
                "conf_dis": r.conf_dis,
            }
        )
    return pd.DataFrame.from_records(recs)


def print_aggregates(result: dict) -> None:
    n = result["n_human"]
    print(f"N = {n} human verdicts (of {result['n_target']})")
    print()
    df = table_df(result)
    # Display rates as 0-1; keep pandas formatting tight.
    with pd.option_context("display.max_rows", 50, "display.width", 140, "display.float_format", "{:0.3f}".format):
        print(df.to_string(index=False))
    print("appendix: pabak = Brennan–Prediger / PABAK, k=3; pre-registered thresholds still use kappa")
    print()
    print(f"N = {n}")
    print(
        "H2  mean clause agreement  "
        f"J-contract {fmt(result['h2_contract'])}  "
        f"J-generic {fmt(result['h2_generic'])}  "
        f"Δ (C−G) {fmt(result['h2'])}"
    )
    print(f"N = {n}")
    c, nv = result["h4"]["C"], result["h4"]["N"]
    print(
        "H4  human overall pass rate (pass or pass with notes)  "
        f"C {fmt(result['h4_rate_C'])} (n={c['n']})  "
        f"N {fmt(result['h4_rate_N'])} (n={nv['n']})  "
        f"Δ (C−N) {fmt(result['h4_delta'])}"
    )
    counts = result["overall_counts"]
    parts = ", ".join(f"{k}={v}" for k, v in sorted(counts.items(), key=lambda kv: kv[0]))
    print(f"N = {n}  overall mix: {parts}")
    print()
    print("aggregates only; condition mappings sealed until after session B")


def refuse_full(n: int) -> None:
    print(
        f"refused: --full stays sealed until after session B (self-consistency); "
        f"unblind is not at {TARGET_N} rows (have N={n}). "
        f"Knowing condition mappings could bias re-verdicts."
    )


def main(argv: list[str] | None = None) -> int:
    root = assert_cwd()
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--full",
        action="store_true",
        help="per-variant detail (sealed until after session B, even at 63 rows)",
    )
    args = parser.parse_args(argv)

    human = load_human(root)
    n = len(human)
    if args.full:
        refuse_full(n)
        return 2

    judges = load_judges(root)
    conditions = load_conditions(root)
    result = compute(human, judges, conditions)
    print_aggregates(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
