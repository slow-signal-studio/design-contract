# Experiment 1: Can a machine judge track one designer's judgment-layer verdicts?

Pre-registered protocol. Thresholds are set before any data exists so results can't be read charitably after the fact.

## The question
Everything below the floor (tokens, contrast, spacing) is already checkable. The open question is the layer above it: hierarchy, composition, authorship. Can a vision model, given an explicit personal contract and anchor examples, agree with the designer's own verdicts on those qualities often enough to be trusted on some of them, and can we find out exactly which ones?

## Hypotheses and predictions (written before running)

H1, tracking. A judge given the contract and anchors agrees with Roya's clause-level verdicts above chance on at least some judgment clauses.
Prediction: moderate agreement (kappa 0.4 or higher) on at least two of the seven clauses; weak or none on at least one.

H2, standards matter. The same judge WITHOUT the contract and anchors (generic rubric wording only) agrees with Roya less than the judge WITH them.
Prediction: the contract condition beats the generic condition by at least 10 percentage points of agreement, averaged across clauses. This is the COLM claim (misalignment is mostly standards, not scoring) tested on design.

H3, per-clause variance. Agreement differs by clause, and the differences identify what the machine can and cannot judge.
Prediction: hard-proxied clauses (density, restraint) agree more than abstract ones (signature, point of view). Rubric question 4 (content-specific composition) is the most likely to fail.

H4, the contract improves generation. Variants generated WITH the contract in context receive better verdicts from Roya, blind, than variants generated WITHOUT it.
Prediction: the contract condition's pass rate exceeds the no-contract condition's by at least 15 points. If this fails, it is a major finding: the contract would be shaping judgment but not generation.

H5, self-consistency ceiling. Roya's agreement with her own earlier verdicts (re-verdicting a subset later) sets the ceiling any judge can reach.
Prediction: self-agreement between 80 and 90 percent on hard-proxied clauses, lower on abstract ones. No judge is expected to beat the ceiling; a clause is licensable only relative to it.

## Materials

Surfaces: four sections of royamonty.com, chosen for distinct compositional problems: the hero, a timeline entry, a case-study body section with figure and caption, and the featured block.

Anchors: frozen captures of the timeline page and the Loop Visibility case study (the anchor block), with commit refs.

Variants: for each of the four sections, a builder agent generates 8 variants WITH the full contract in context and 8 WITHOUT (same prompt, contract removed). 64 variants total. Variety injection: each generation run uses a fresh random seed string as design inspiration (String Seed of Thought), so the eight variants within a condition genuinely differ rather than collapsing toward the model's default; the same seed strings are used across the two conditions so condition is the only difference. Each is rendered to a screenshot. A hidden manifest records condition; Roya never sees it until analysis.

Clauses under test (seven):
1. density: one clear primary read; supporting elements register independently
2. hierarchy: primary message identifiable within a second
3. restraint: no element carrying zero information
4. earned-convention: every visible treatment performs a role
5. rubric Q1: clear point of view about what deserves attention
6. rubric Q2: figures treated as primary evidence, not content in containers
7. rubric Q4: at least one content-specific compositional decision (the transferability test)

Judge configurations:
- J-contract: DESIGN.md + clause definitions + anchors + evidence-citation requirement + stated confidence
- J-generic: identical clause wording and scoring format, no DESIGN.md, no anchors, no reasoning layer
Both score every variant on every clause: yes / partial / no, cited region, confidence 0 to 1. Both also produce one comparative output per variant: rank it against the two anchor pages (above both, between, below both) on overall authorship, since comparative judgments are more reliable than absolute scores. Each judge runs twice with variant order reversed to measure position bias.

## Procedure

Step 0. Freeze anchors (the pending anchor block). Nothing runs before this.

Step 1. Generate the 64 variants. Randomize their IDs. Store the condition manifest encrypted or in a file Roya does not open.

Step 2. Run both judges over all 64 variants, seven clauses each, two orderings. Store every score with its cited region and confidence. Roya does not look at judge output yet.

Step 3. Roya's verdict session A. Variants shown in random order, no condition labels, no judge scores. For each variant: seven clause verdicts (yes / partial / no), a one-line reason required on every partial or no, and one overall verdict (pass / pass with notes / fail). Split across two sittings if needed; randomize within each.

Step 4. Roya's verdict session B, at least several days after A, no rereading of A. Re-verdict a random 20 of the 64 variants on all seven clauses. This is the self-consistency ceiling.

Step 5. Analysis, all pre-specified below.

Step 6. Disagreement review. For every clause where J-contract and Roya disagree, Roya tags the disagreement with exactly one label: judge wrong; Roya wrong on reflection; clause ambiguous as written; judge cited the wrong region. These tags are the rubric-revision worklist.

## Measurements

Per clause, per judge configuration:
- raw agreement with Roya (percent exact match on yes / partial / no)
- Cohen's kappa (agreement corrected for chance)
- agreement relative to ceiling: judge agreement divided by Roya's self-agreement on that clause
- position-bias rate: percent of scores that changed between the two orderings
- evidence validity: on a random 40 judge answers, does the cited region actually show what the answer claims (Roya rates yes / no)

Across conditions:
- H2: mean agreement difference, J-contract minus J-generic
- H4: Roya's overall pass rate, contract-generated minus no-contract-generated

## Decision thresholds (pre-registered)

Licensable clause (eligible for silent pass in the router): kappa 0.6 or higher AND agreement at least 85 percent of the self-consistency ceiling AND position-bias rate under 10 percent, over all 64 items. Prediction: zero to two clauses qualify on the first run.

Revisable clause: kappa between 0.2 and 0.6, with disagreement tags concentrated in "clause ambiguous" or "wrong region." Action: rewrite the clause or its evidence instruction, rerun.

Human-only clause (for now): kappa under 0.2, or disagreement tags concentrated in "judge wrong." Action: the router always summons on this clause; the finding is published as such.

H1 fails outright if no clause reaches kappa 0.4 in the contract condition. H2 fails if the contract condition does not beat generic by 10 points. H4 fails if the pass-rate gap is under 15 points. Each failure is written up as a result, not softened.

## Controls and known confounds

- Roya is blind to condition and to judge scores during verdicts.
- J-generic uses identical clause wording; only the contract, anchors, and reasoning layer are removed, so the difference isolates standards.
- Order randomized for Roya and reversed for judges to expose position bias (the TASTE paper's warning).
- All 64 variants are agent-generated; none are Roya's own work, avoiding authorship recognition.
- Sessions split to limit fatigue effects; session B separated in time to measure genuine self-consistency.
- Judge model and prompt versions are pinned and recorded; the curve is per version.

## Effort estimate

Roya's time: session A is roughly 64 variants by 7 clauses at about ten seconds each, plus reasons on partials and fails, around 90 minutes across two sittings; session B about 25 minutes; disagreement tagging about 30 minutes. Everything else is machine time.

## Outputs

1. The first calibration curve: per-clause agreement for both judge conditions, plotted against the self-consistency ceiling.
2. A licensing decision per clause: licensable, revisable, human-only.
3. The disagreement taxonomy with counts, which is the rubric-revision worklist and the most honest paragraph of build log post three.
4. The H4 result: whether the contract measurably improves what agents generate, blind.
5. A published negative result if any hypothesis fails, stated as plainly as a positive one.

## What this experiment does not test
Whether strangers perceive the outputs as chosen (Experiment 3). Whether the mini-contract mechanism works for a designer who did not write the contract (Experiment 2). Deep delight, excluded by design. Long-horizon drift, which needs months of verdicts.
