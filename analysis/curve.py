"""Calibration curve: per-clause agreement bars. Aggregates only."""

from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.patches import Patch

from compute import CLAUSES, assert_cwd, compute, load_conditions, load_human, load_judges, refuse_full

GROUND = "#F5F3EB"
INK = "#1A1A1A"
MUTED = "#5A5A55"


def mono_font() -> str:
    wanted = ("JetBrains Mono", "JetBrainsMono", "JetBrainsMono-Regular")
    available = {f.name for f in font_manager.fontManager.ttflist}
    for name in wanted:
        if name in available:
            return name
    for f in font_manager.fontManager.ttflist:
        if "jetbrains" in f.name.lower() or "jetbrains" in Path(f.fname).name.lower():
            return f.name
    for name in ("Menlo", "Consolas", "DejaVu Sans Mono", "monospace"):
        if name in available or name == "monospace":
            return name
    return "monospace"


def render(result: dict, out: Path) -> None:
    font = mono_font()
    plt.rcParams.update(
        {
            "font.family": font,
            "text.color": INK,
            "axes.labelcolor": INK,
            "xtick.color": INK,
            "ytick.color": INK,
            "axes.edgecolor": INK,
            "figure.facecolor": GROUND,
            "axes.facecolor": GROUND,
            "axes.grid": False,
            "axes.spines.top": False,
            "axes.spines.right": False,
        }
    )

    n = result["n_human"]
    agree = {(r.clause, r.judge): r.agreement for r in result["rows"]}
    fig, axes = plt.subplots(nrows=len(CLAUSES), ncols=1, figsize=(8.5, 10), sharex=True)
    fig.patch.set_facecolor(GROUND)

    for ax, clause in zip(axes, CLAUSES):
        ax.set_facecolor(GROUND)
        y_c, y_g = 1.15, 0.35
        ac = agree.get((clause, "J-contract"), float("nan"))
        ag = agree.get((clause, "J-generic"), float("nan"))
        if ac == ac:
            ax.barh(y_c, ac, height=0.55, color=INK, linewidth=0)
        if ag == ag:
            ax.barh(y_g, ag, height=0.55, color=MUTED, linewidth=0)
        ax.set_xlim(0, 1)
        ax.set_ylim(-0.3, 1.8)
        ax.set_yticks([])
        ax.set_ylabel(clause, rotation=0, ha="right", va="center", fontsize=9, labelpad=12)
        ax.axvline(0, color=INK, linewidth=0.4)
        ax.axvline(1, color=INK, linewidth=0.4)
        ax.tick_params(axis="x", length=0)
        ax.spines["left"].set_visible(False)
        ax.spines["bottom"].set_linewidth(0.4)
        ax.text(1.01, 1.4, "ceiling pending", color=MUTED, fontsize=7, va="center", ha="left")

    axes[-1].set_xlabel("agreement (exact match)", fontsize=9)
    axes[-1].set_xticks([0, 0.5, 1.0])
    handles = [
        Patch(facecolor=INK, label="J-contract"),
        Patch(facecolor=MUTED, label="J-generic"),
    ]
    fig.legend(handles=handles, loc="upper right", frameon=False, fontsize=8)
    fig.suptitle(f"calibration curve   N = {n}", fontsize=11, color=INK, x=0.05, ha="left")
    fig.tight_layout(rect=(0.12, 0.04, 0.82, 0.96))
    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out, dpi=160, facecolor=GROUND)
    plt.close(fig)


def main() -> int:
    root = assert_cwd()
    if "--full" in sys.argv:
        refuse_full(len(load_human(root)))
        return 2
    human = load_human(root)
    judges = load_judges(root)
    conditions = load_conditions(root)
    result = compute(human, judges, conditions)
    out = root / "reports" / f"curve-{date.today().isoformat()}.png"
    render(result, out)
    print(f"N = {result['n_human']}  wrote {out.relative_to(root)}")
    print("aggregates only; condition mappings sealed until after session B")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
