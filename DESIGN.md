# DESIGN.md
Design contract for royamonty.com. First commit of the verification loop.
Purpose: output judged against this contract should read as the work of a principal-level product and visual designer, not as tool-default output. The hard layer guarantees competence; the soft layer and refusals encode the choices that make it unmistakably chosen. A page that passes every hard assertion and carries no visible opinion is a FAIL of purpose.
Two layers: INVARIANT (travels across all projects) and SITE (this project only).
Two kinds of rules: HARD (machine-checkable assertion, exact value or threshold) and SOFT (judgment clause, scored by vision call with confidence).

## INVARIANT LAYER

### Hard assertions
- cosmetic-elevation: no drop shadows on flat fills, images, text, controls, or containers merely to create separation or polish; separation comes from spacing, rules, contrast, overlap, or actual spatial behavior. Hard source-level assertion; shadows require a registered exception naming the spatial behavior they serve. (Sharpens refusal 4.)
- contrast: all text meets WCAG AA (4.5:1 body, 3:1 large text)
- attention: at most ONE red/alert element per viewport
- motion: entrance transitions are 8px translate + fade, 180ms, ease-out; no other entrance styles
- tokens: typography, layout spacing, and recurring dimensional relationships come from named CSS custom properties in rem (e.g. --type-body: 1rem; --leading-body: 1.55; --space-title-body: 0.75rem; --space-paragraph: 1.5rem; --space-entry: 4rem; --space-section: 6rem). Raw values in these categories are a hard FAIL unless listed in EXCEPTIONS below. Borders, hairlines, transforms, shadows, animation geometry are outside token scope.
- assertion-format: every numeric render assertion states Target and Acceptable (e.g. body leading Target 1.55, Acceptable 1.50-1.65; measure Target 62-66ch, Acceptable 58-70ch). Exact-match assertions are forbidden.
- type-roles: micro JetBrains Mono 0.6875rem/1.3 (optical exception only, never essential info); meta/nav 0.75rem/1.4; body Inter 1rem/1.55; entry title Newsreader 1.5-1.75rem/1.1-1.15; page display Newsreader 2.25-3rem/1.0-1.1; hero clamp() with explicit min and max
- type-minimum: 0.75rem floor for navigation, metadata, dates, labels; 0.6875rem only for sparse uppercase mono eyebrows carrying secondary info
- spacing-scale: 4px grid expressed as rem tokens; semantic tokens by relationship, not freely chosen values
- two-tier verification: source lint enforces token discipline and the exception registry; render checks verify computed outcomes within Acceptable ranges across breakpoints
- zoom-contract (WCAG 1.4.4): at 200% text resize, no essential text clipped or truncated, no interactive control inaccessible, no overlap that prevents reading, no horizontal scroll for ordinary text content

### Exceptions registry (linter reads this; unregistered raw values fail)
- [none yet; format: selector | value | reason]

### Soft clauses
- hierarchy: primary action or message is identifiable within one second of looking
- restraint: no decorative elements that carry zero information
- display-leading: Newsreader display sizes read optically tight, not airy; leading tightens as size grows
- earned-convention (governing principle): no design convention exists merely because the interface feels unfinished without it. Every visible treatment performs a structural, informational, behavioral, or project-specific expressive role. When hierarchy can be achieved through typography, spacing, alignment, or the work itself, those primitives win.

### Refusals (each: prohibition, replacement, enforcement)
Refusals describe intent. Mechanical checks enforce only what can be observed reliably; ambiguous patterns trigger review rather than pretending the linter can infer design judgment.
Enforcement classes: HARD ASSERTIONS (token discipline, gradient prohibition, reduced-motion compliance, registered radius exceptions, no raw interaction colors, no unapproved motion primitives). PROXY TRIPWIRES (card density, pill geometry, excessive nonzero radius, repeated shadow-container patterns). REVIEW TRIPWIRES (three or more consecutive equal-width project tiles, template-like case-study heading sequences, repeated generic showcase anatomy).
All tripwire thresholds are tunable values declared in this file; adjusting them is a scheduled output of the calibration review, not an ad hoc reaction.
1. No cards as default container. Replace with composition, whitespace, rules, alignment, scale; a container exists only when containment means something. Enforce by proxy: bordered/shadowed wrappers above threshold per viewport flag for review.
2. No pill UI as decoration (tags, chips, badges, capsules). Replace with the annotation language: small mono type, uppercase where apt, typographic separators, alignment. Enforce: border-radius >= half element height on short text elements lints as pill; fails unless registered.
3. No generic portfolio grids (auto three-column, bento, equal tiles, alternating template). Replace with editorial composition: importance, content, proportions, chronology set scale and placement; repetition needs a structural reason. Enforce: tripwire only. Three or more consecutive equal-width project tiles summons a vision call and a human verdict; never auto-fails.
4. No decorative UI effects (gradients, glassmorphism, glow, blur-as-decoration, shadow excess, orbs, noise, gradient text, ornamental depth). Replace with typography, image scale, cropping, negative space, contrast, sequencing, purposeful motion. Enforce: source lint, hard fail.
5. No gratuitous rounding. Radius zero is the default token; nonzero radius requires a registered exception naming why the object's behavior or concept warrants it. Enforce: source lint on radius tokens, hard fail on unregistered nonzero radius.
6. No generic icon language (sparkle, arrow, brain, wand, robot, checkmark, decorative feature icons; no icon library to make sections feel complete). Replace with language, typography, numbering, symbols, project-specific graphics; icons only for functional actions where they beat text. Enforce: source lint on icon imports outside a registered functional set.
7. No manufactured AI motion (ambient float, perpetual pulse, gratuitous parallax, springy-everything, staggered reveal per section, cursor-following decoration). Motion must explain state, reveal structure, establish spatial continuity, respond to input, or serve a named expressive concept; otherwise still. Enforce: mechanical parts lint (infinite animations, scroll-triggered stagger counts); judgment parts are soft clauses. Companion hard assertion: all non-essential motion disabled under prefers-reduced-motion; motion that cannot be removed without breaking comprehension is, by definition, structural and allowed.
8. No template case-study anatomy (Overview/Problem/Solution/Process/Impact/Learnings, metric cards, quote cards, numbered feature blocks, terminal CTA). Each project determines its narrative form through figures, annotations, artifacts, evidence, concise writing. Enforce: tripwire only. An h2 sequence matching the template set summons review; never auto-fails.
- tripwire-rule: tripwires exist to summon a vision call plus a human verdict, and every tripwire verdict is a calibration data point. Tripwires never auto-fail.
- density: too dense is when figures, annotations, or text compete for the same level of attention; every view keeps one clear primary read, with enough negative space that each supporting element registers independently.

## SITE LAYER (royamonty.com)

### Hard assertions
- ground: page background is #F5F3EB. Why: warm paper neutral gives editorial physicality; the frame stays quiet because the work is colorful. Amended from #F2EEE3: chosen on sight against the draft value; site's lived ground wins, same precedent as underline offset.
- ink: #1A1A1A carries all information in global UI.
- muted-ink: one muted step #5A5A55 for secondary text (AA-verified 6:1 on ground); it recedes, ink informs; no second muted tone exists. #8A8A82 removed: 3.2:1 on ground fails AA at text sizes.
- no-global-accent: there is no global accent color. Why (recorded so it is not relitigated): the projects supply the color; an accent would compete with the work and turn the site busy. Color belongs to project content and explicitly art-directed project treatments only.
- interaction-spec: text links stay #1A1A1A, identified without color by persistent underline (start 1px thickness, 3px text-underline-offset, optically tuned per typeface); hover changes the underline (thickness up or offset down), opacity may supplement but never solely signal; focus is 2px solid #1A1A1A outline, 3px offset, via :focus-visible, never removed without a designed replacement; interactive icons and controls stay in ink, hover by opacity, underline, inversion, or displacement; disabled reduces ink opacity; no chromatic hover, active, visited, selection, or focus state anywhere in global UI.
- interaction-hard-checks: no default browser-blue links or focus rings; :visited identical to link ink (no browser purple); all keyboard-focusable controls expose a visible :focus-visible state; focus indicator meets 3:1 non-text contrast against adjacent colors; links distinguishable without color; a state needed for comprehension never relies on opacity alone.
- color-tokens: global UI colors resolve to the two tokens above; raw color declarations in UI fail lint.
- gradients: CSS-generated gradients are prohibited in global UI. A CSS gradient requires an explicitly registered component-level exception in this file.
- authored-media exception: colors and gradients inside authored media are unrestricted. Mechanical definition: assets under /artwork paths or elements carrying data-media="authored". Everything else is UI.
- identity-carriers: identity does not come from a brand accent. The shell deliberately recedes so project work carries its own color. The site's recognizable language comes from the Inter/Newsreader/JetBrains Mono relationship, the editorial annotation language, spacing rhythm, composition, figure treatment, and interaction behavior. These systems are identity-bearing and are never replaced with generic portfolio conventions; the refusals exist to protect them.
- labels: annotation labels are monospace JetBrains Mono per the type-roles above
- leader-lines: right-angle only, 1px, terminate in 4px open circle
- figure-grammar: the color grammar (blue operator, yellow display, red attention) is figure-only, inside authored media, never UI tokens.

### Soft clauses
- figures read as Bauhaus-flat: geometric, few colors, no texture
- color as grammar: blue means operator, yellow means display, red demands attention; a figure using color must use it semantically
- SIGNATURE (protected phrase: editorially composed rather than interface-assembled): the work feels editorially composed, not interface-assembled. Strong figures given room to carry the argument, precise annotation that rewards looking closer, deliberate shifts in scale, type, and negative space that create rhythm without decoration. Each project may build its own visual world; the restraint, sequencing, and attention to detail keep the authorship recognizable.
- signature-constants vs project-free: constant across all worlds: annotation language, figure grammar, compositional restraint, the refusals. Free per project: palette, imagery, mood. The judge compares constants and ignores the free layer.
- signature-rubric (vision call, per page): four questions, each scored yes / partial / no, each answer REQUIRED to cite the region or crop that justifies it (evidence beside the verdict applies to the judge too; uncited scores are invalid).
  1. Does the composition have a clear point of view about what deserves attention?
  2. Are figures treated as primary evidence rather than content dropped into containers?
  3. Do typography, annotation, scale, and negative space create the hierarchy rather than decorative UI devices?
  4. Does the page contain at least one composition or relationship specific to this content, such that another portfolio's screenshots and copy could not drop in unchanged? (Serial exemption: pages in a declared serial format are judged against the series' own composition, not uniqueness.)
- signature-anchors: the rubric runs comparatively against designated anchor pages supplied to the judge with each review. Anchors are frozen captures (dated screenshot set + the commit ref they were rendered from), never live URLs; re-anchoring is an explicit, versioned act with a diff, so redesigns cannot silently move the taste baseline. Designated: (1) timeline/homepage, establishing editorial composition, annotation, rhythm, and sequencing; (2) Loop Visibility case study, establishing authorship carried into a focused narrative with figures and evidence. Third slot intentionally empty until a page demonstrates a genuinely different mode; never filled for completeness.

## REASONING LAYER
For each rule above that isn't self-evident, one line on WHY, because rules without reasons get deleted by future-you and can't be trusted by agents.
- one-red-element: attention is a budget; two alerts is zero alerts
- motion 8px/180ms: 8px makes state change perceptible without turning movement into spectacle; 180ms keeps direct interaction feeling immediate while the transition stays readable
- no-global-accent: recorded in the site layer; the work supplies the color, the frame declines to compete
- dark-section palette (obsidian/graphite/sand family) removed as aspiration-drift; a future dark scope requires its own registered mini-contract
- OPEN DECISION (dated 2026-08-27, decide after Monday applications ship): Newsreader + warm ground + sparse black sits close to Anthropic's visual territory at the system level. First response is compositional, not typographic: push the behaviors already in the signature clauses (abrupt scale shifts, tighter display leading, asymmetric placement, annotation collisions). If resemblance persists after that, run the display-face exercise: 3-5 candidates chosen to break the resemblance while holding with Inter and JetBrains Mono. Ground and ink do not change.
- [FILL as you go; incomplete is fine, absent is not]

## CHECKER NOTES (for week 2, ignore today)
Hard assertions -> Playwright + computed styles + DOM measurement.
Soft clauses -> vision call per clause, per screen, returning score + confidence + region crop.
Verdict vocabulary: pass / pass with notes / fail.
Calibration record, stored per review: judge verdict, cited evidence (region/crop), human verdict, and on disagreement a reason tagged to the specific rubric question that diverged (free text allowed, tag required). This is the training data for rubric and threshold tuning.
