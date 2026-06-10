# Memory Export — 2026-06-08

> Export of `~/.claude/projects/-workspace/memory/` from the previous sandbox.
> Drop this file in the new sandboxed session and ask Claude to read it before
> starting work. Pair with `SESSION-HANDOFF.md` for the active-task context.
>
> **Source:** local Claude auto-memory (NOT gbrain — gbrain is excluded by the
> two "no-gbrain" rules below, and the user explicitly asked for the local
> memory only).
>
> **Important caveat (from system reminders):** "Memories are point-in-time
> observations, not live state — claims about code behavior or file:line
> citations may be outdated. Verify against current code before asserting as
> fact." Treat dates and "shipped" claims as snapshots.

---

## How a new session should use this file

1. Read this whole file once at session start.
2. **Active project for the resume context (`SESSION-HANDOFF.md`) is `classroom-log`.** Apply classroom-log-scoped memories as fact; treat AI-coach-scoped memories as background context only.
3. Cross-project rules (user, gbrain, container, git identity, skill discipline) apply everywhere.
4. If a memory ever conflicts with what the code actually shows, trust the code (per `feedback_code_is_truth`) and flag the stale memory.

---

## MEMORY.md index (as loaded into the previous session)

```
- [Code is truth, not docs](feedback_code_is_truth.md) — user treats source code as the only authoritative state; don't lead with doc/code drift findings
- [Memory project scope](feedback_memory_project_scope.md) — `project_*`/`feedback_*` memories may be scoped to ONE of two projects (AI-coach vs classroom-log); verify scope from file body before applying as fact, and tag scope when writing new project memories
- [Invoke skills FIRST, not after](feedback_invoke_skills_first.md) — adherence sloppy (2026-05-29); invoke the relevant superpowers skill via Skill tool BEFORE the action, not as cleanup; "I know the rule" is the rationalization the skill exists to prevent
- [Superpowers in every subagent](feedback_superpowers_in_subagents.md) — when using any superpowers skill, EVERY dispatched subagent must also be instructed to use the appropriate superpowers skills (TDD, verification-before-completion, etc.); don't drop discipline at the subagent boundary
- [Founder profile (AI-coach)](user_founder_profile.md) — pjmeijer is male, has a partner (gender unspecified); solo founder using Claude Code; bilingual EN/DA; uses somatic experiencing personally; don't assume founder pronouns
- [Windows host (PowerShell)](user_windows_host.md) — user runs backend/scripts on Windows PowerShell at C:\Users\pjmei\source\repos\AI-coach; backend started with `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000` from `backend/`; provide Python/PowerShell, never bash, for runnable scripts
- [No speculative bugs in tracking docs](feedback_no_speculative_bugs.md) — only log bugs with observable evidence of breakage; don't pre-emptively add "might be broken if X" entries to docs/known-bugs.md
- [Railway parked 2026-05-20 — AI-coach only](project_railway_parked.md) — AI-coach scope only. Phase 2 tester flow is local backend + Expo tunnel; Showstoppers 1a/1b deferred (Railway-only), 1c fixed locally; revisit when scaling. Does NOT apply to classroom-log.
- [classroom-log infra (2026-06-04)](project_classroomlog_infra.md) — classroom-log scope. Railway running (free tier), Apple Dev Program paid, cohort path is EAS Build → TestFlight. Distinct from AI-coach Railway state above.
- [README needs TestFlight section](project_readme_testflight_update.md) — classroom-log scope, 2026-06-04. Root README + mobile/README must gain Testing/Distribution sections + drop stale "TestFlight out of scope" wording when EAS pipeline lands. Folded into Task 10 Step 4 of the EAS plan.
- [Git identity (pjmeijer)](user_git_identity.md) — use `pjmeijer <pjmeijer@me.com>` for commits, not the Apple privaterelay email from system context
- [Container has no sudo](project_environment_no_sudo.md) — Claude Code workspace is a sandboxed `claudeuser` container; apt installs and `! sudo` won't work; suggest userspace alternatives or out-of-session install
- [Always work in branches](feedback_always_work_in_branches.md) — never do implementation work directly on main; check `git branch --show-current` at task start and create/switch to a feature branch first
- [Subagent git boundary](feedback_subagent_git_boundary.md) — implementer subagents silently FF-merge and make scope-creep commits unless explicitly forbidden in their prompt; always state "stay on feature branch, controller does merges"
- [Codex for code reviews](feedback_codex_for_reviews.md) — always use `/codex review` for code-quality reviews instead of in-session subagent reviewers; spec-compliance subagent (mechanical plan-vs-code check) is OK to keep
- [Tracking IS implemented (not dormant)](project_tracking_dormant.md) — AI-coach scope. Full end-to-end feature: backend + `mobile/app/tracking.tsx`+`tracking/log.tsx`+`tracking/setup.tsx`+`store/useTrackingStore.ts`. Phase 1 1h plan shipped 2026-05-04. mobile/ uses Expo Router at mobile/app/, NOT mobile/src/.
- [Gbrain for design intent (AI-coach only)](feedback_use_gbrain_for_design.md) — AI-coach scope only. Does NOT apply to classroom-log (see no-gbrain-in-classroomlog).
- [No gbrain in classroom-log (project scope)](feedback_no_gbrain_in_classroomlog.md) — hard rule (2026-06-04): no gbrain CLI / MCP tools / `/sync-gbrain` in classroom-log at all.
- [Extraction depth (coaching signals)](project_extraction_depth.md) — AI-coach scope.
- [Coaching ethic — observations not interpretations](project_coaching_ethic.md) — AI-coach scope.
- [Memory architecture — custom SQL, NOT Graphiti](project_memory_architecture_decision.md) — AI-coach scope.
- [Wisdom-tradition reframe (2026-05-24)](project_wisdom_tradition_reframe.md) — AI-coach scope.
- [Review diminishing returns](feedback_review_diminishing_returns.md) — cross-project feedback rule.
- [Two containers share gbrain](project_two_containers_share_gbrain.md) — infra fact, superseded by no-gbrain-in-container.
- [No gbrain in this container](feedback_no_gbrain_in_container.md) — hard rule (2026-05-27): never call gbrain CLI / MCP tools from this container.
- [classroom-log domain](project_classroom_log_domain.md) — classroom-log scope. Notes are teacher observations of students, NEVER student speech.
```

---

# USER MEMORIES (apply everywhere)

## user_founder_profile.md

> pjmeijer (GitHub) is the AI-coach founder. Male, has a partner (gender unspecified). Solo founder, builds with Claude Code, has shipped Phase 1 + sub-projects. Don't assume founder pronouns or partner gender.

**Identifying details:**
- GitHub username: pjmeijer
- Email used for commits: pjmeijer@users.noreply.github.com
- Repo: github.com/pjmeijer/AI-coach (also github.com/pjmeijer/classroom-log)
- Solo founder (no co-founders mentioned)

**Pronouns / personal:**
- Founder is **male** ("his partner" — user-corrected 2026-05-16)
- Partner's gender is **unspecified** — don't assume
- N=2 user pair (AI-coach) is "founder + his partner"

**How they work:**
- Solo, builds with Claude Code
- Uses Apple ecosystem (iCloud Private Relay email pattern)
- Bilingual EN/DA — possibly Danish based (apps support en + da)
- Low patience for skill ceremony — wants direct, actionable output
- Treats code as truth

**Product domain knowledge (AI-coach context):**
- Personal experience with somatic experiencing therapy
- Already uses Claude chat for personal reflection / shadow work
- Has thought about wisdom traditions, philosophy, named teachers
- Has thought through IP architecture (70-year rule) and clinical-distance positioning

**How to apply:**
- Use "he/his" for the founder; "they/them" or "the partner" for the partner.
- Don't say "the user" when you can say "you" — the founder reads their own docs.
- Frame product decisions around their own usage when possible.

---

## user_windows_host.md

pjmeijer's local dev environment is **Windows PowerShell**. Repos live under `C:\Users\pjmei\source\repos\<repo-name>`. Multiple repos confirmed: `AI-coach` and `classroom-log` at minimum. The container's `/workspace` corresponds to whichever repo the current Claude Code session was launched from — do NOT assume `AI-coach`.

Backend (uvicorn), tests, and any runnable scripts execute on Windows.

The `/workspace` Claude sees is NOT the user's Windows tree — it's a sandboxed container filesystem. Files I create at `/workspace/...` get synced to the user's Windows repo via Claude Code's mechanism.

**When creating runnable scripts:**
- **Use Python (`.py`) for cross-platform tooling** — backend already requires Python, runs identically on PowerShell/cmd/bash.
- **PowerShell (`.ps1`) is acceptable** for Windows-only tasks.
- **Do NOT use bash `.sh` scripts** for anything the user will execute — PowerShell can't interpret `#!/usr/bin/env bash`.
- Linux idioms (`ls -la`, `head`, `tail`, `grep`, `sed`) only work on my side. Don't suggest them to the user.

**Windows env-var syntax (PowerShell):**
- `$env:ANTHROPIC_API_KEY="sk-ant-..."; python -m uvicorn ...`
- NOT `ANTHROPIC_API_KEY=... python ...` (that's bash inline-env).

**User's actual backend-start command** (confirmed 2026-05-22 for AI-coach; same pattern for other repos with `backend/`):
```powershell
PS C:\Users\pjmei\source\repos\<repo>\backend> uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- Invoked from `backend/` directory (not repo root).
- Uses `uvicorn` console script directly, NOT `python -m uvicorn`.
- Binds `0.0.0.0:8000` so Expo / LAN devices can hit it.
- ANTHROPIC_API_KEY in shell env or `.env` — don't add `$env:...=`.

**As of 2026-06-08:** user is getting a Mac Mini to debug iOS TestFlight builds. Mac becomes the primary iOS dev surface; Windows remains the backend host.

---

## user_git_identity.md

For git commits in pjmeijer's projects, the author identity is:

```
pjmeijer <pjmeijer@me.com>
```

**Why:** System context exposes an Apple privaterelay email (`m49rcczbgd@privaterelay.appleid.com`) — that's for Apple sign-in only, not git. Using it would split commit attribution on GitHub. Verify against `git log -1 --format="%an <%ae>"` before committing.

**How to apply:** If `git config user.email` is unset on a fresh clone, set it repo-local (`git config user.email pjmeijer@me.com`, no `--global`). Don't ask the user unless `git log` shows a different established identity for that repo.

---

# CROSS-PROJECT FEEDBACK RULES (apply everywhere)

## feedback_code_is_truth.md

User explicitly stated: "Current state is the code." Their mental model: code is truth; specs/plans are static snapshots useful for orientation but not for verifying state.

**Why:** User is hands-on, reads code directly. They don't audit docs against code; they audit each other against the code when needed. Treating drift as a finding wastes their attention on bookkeeping they don't value.

**How to apply:**
- Don't lead with "doc X is stale vs code." Mention once if relevant, move on.
- For UI redesigns or big code changes, treat plan/spec files as historical reference; don't push the user to update them.
- Answer "what's next?" from code + roadmap intent, not "as-built" specs.
- Don't propose updates to `current-state.md`-style living-doc artifacts unless asked.

---

## feedback_memory_project_scope.md

The user runs two distinct projects from this Claude workspace: **AI-coach** (`C:\Users\pjmei\source\repos\AI-coach`) and **classroom-log** (`C:\Users\pjmei\source\repos\classroom-log`). Memory entries with generic `project_*` or `feedback_*` names may apply to only one of them — not both.

**Why:** User flagged 2026-06-04 when I applied AI-coach `project_railway_parked` to a classroom-log discussion. Wrong-project memory drove wrong recommendations.

**How to apply:**

- Before citing a `project_*` memory, check the file body for signals:
  - **AI-coach signals:** "coaching", "tracking", "memory v2", "wisdom tradition", "Task 11", `backend/.env` + `config.py:6`, `docs/known-bugs.md`, `docs/testing-setup.md`.
  - **classroom-log signals:** "classroom-log", "observation", "student tile", "voice-first", `mobile/app/note/[studentId].tsx`, `docs/superpowers/feedback/*-device-test.md`, warm-paper palette (terracotta + Source Serif).
- If signals are mixed, ask before relying on memory as fact.
- When writing new project memory, add `**Scope: <project> only**` near the top.
- Cross-project memories (gbrain, container, git identity) don't need scope tags.
- Do NOT verify via gbrain; use grep / file reads / user confirmation.

---

## feedback_invoke_skills_first.md

User feedback (2026-05-29) after sloppy skill adherence during voice-first-capture Tasks 10-12:

> "Remember to invoke skills from now on to anything you do. Also each agent should use skills. Where can we write this/remember this so you will adhere. Adherence have been sloppy."

**The rule:** Before *any* code-changing or behavior-changing action, invoke the relevant superpowers skill via the Skill tool. Not "I'll remember the principle." Invoke. The skill content loads; THEN you act.

**Concrete failure modes this prevents:**
- **TDD violation:** Writing impls in parallel with RED-verify because "the failure mode is obvious."
- **Verification-before-completion skipped:** Claiming "DONE" before invoking the skill.
- **Invoking after the fact:** Reading the skill content after the action is too late.

**How to apply:**

1. **Before any production code write/edit:** invoke `superpowers:test-driven-development`. Wait for FAIL evidence; don't parallelize.
2. **Before claiming "done"/"complete"/"fixed":** invoke `superpowers:verification-before-completion`. Run actual verification commands.
3. **Before creative/feature work:** invoke `superpowers:brainstorming` first.
4. **Before acting on code-review feedback:** invoke `superpowers:receiving-code-review`.
5. **Before merge/PR/ship:** invoke `superpowers:finishing-a-development-branch`.
6. **Every Agent dispatch:** name required superpowers skills explicitly in the prompt.
7. **Rationalization red flags:** "I know what that means", "I remember this skill", "the skill is overkill", "just a simple question", "let me explore first". STOP when these appear. Invoke anyway.
8. **The 1% rule binds:** "Even a 1% chance a skill might apply means invoke." Treat literally.

There is no "I forgot" — the rule is in context. The only failure mode is rationalizing past it.

---

## feedback_superpowers_in_subagents.md

User stated: *"use superpowers skills in each agent you use as well when using superpowers. remember that. always"*

**Why:** Superpowers is a discipline framework — TDD, verification before completion, requesting code review, systematic debugging. If a subagent gets dispatched without superpowers instructions, the chain of discipline breaks at that boundary.

**How to apply:**

1. When writing plans (`superpowers:writing-plans`): include explicit "REQUIRED SUB-SKILL" notes per task or at plan header.
2. When dispatching subagents: every prompt must name the relevant superpowers skill(s):
   - Bug fix → "Use superpowers:test-driven-development AND superpowers:verification-before-completion before claiming done."
   - Feature → "Use superpowers:test-driven-development. Use superpowers:verification-before-completion before reporting status."
   - Refactor → "Use superpowers:test-driven-development to ensure no regression."
   - Code review → "Use superpowers:requesting-code-review."
   - Debug → "Use superpowers:systematic-debugging."
3. Re-state the requirement for each dispatch; don't assume carry-over.
4. In plan files: header-level rule, not buried.
5. **Discipline propagation is on me. Don't drop it.**

---

## feedback_always_work_in_branches.md

Always work on a feature branch, never directly on `main`. Implementation work (code edits, subagent dispatches, multi-step changes) must happen on a non-main branch. Quick docs-only commits explicitly asked-for on main are the only exception.

**Why:** Clean main + reviewable PR workflow. Working on main bypasses code review and makes mistakes harder to roll back.

**How to apply:** At task start, check `git branch --show-current`. If `main`, ask which branch to use or create one. Pair with `subagent-git-boundary` and `superpowers-in-subagents`.

---

## feedback_subagent_git_boundary.md

When dispatching implementer subagents (via Agent tool with `subagent-driven-development`), the subagent prompt MUST explicitly constrain git operations to the feature branch. Subagents will silently FF-merge to main, make scope-creep commits, and switch branches without explicit prohibition.

**Why:** Confirmed 2026-05-22 during AI-coach Phase 2 Task 3. Subagent committed Task 3 (`c50c66a`), made unauthorized housekeeping commit (`c64197b`), then `git checkout main && git merge --ff-only` — landing both on main and bypassing user's review gate.

**How to apply:**

1. State explicitly: "**Your job is to land a clean commit on the feature branch and nothing else.** Do NOT `git checkout main`, do NOT `git merge`, do NOT FF-merge, do NOT push. The controller handles all merges."
2. Constrain scope: "**Do not make any commit outside the files explicitly listed in the task.** If you notice an untracked file or housekeeping opportunity, surface it in DONE_WITH_CONCERNS — do not commit it."
3. After subagent completes: `git log main --oneline -3` and `git branch -v` to catch unauthorized state changes early.

Applies to ANY subagent with shell/git access, not just implementers.

---

## feedback_codex_for_reviews.md

For any code review step — AND for any design spec — invoke `/codex review` rather than dispatching an in-session code-quality reviewer subagent. **Specs count: 2026-06-04 codex review of the EAS spec caught 10 P1 errors that in-session review missed.**

**Why:** Codex provides an independent second opinion from a different model family — catches issues in-session reviewers (same model) systematically miss.

**How to apply:**
- In `subagent-driven-development`: keep implementer + spec-compliance reviewer subagents, but REPLACE the code-quality-reviewer step with `/codex review`.
- For `/review` or any code-review request, invoke `/codex review` directly.
- For specs from `superpowers:brainstorming`: after Write + self-review + commit, invoke `/codex review` against the spec diff before asking user to review. Treat any `[P1]` as GATE FAIL; revise and re-run until PASS.
- Container quirk: `/codex review --read-only` fails because bwrap isn't installed. Use **custom-instructions path** (embed diff in prompt body).

---

## feedback_review_diminishing_returns.md

**Rule.** When external multi-LLM review of a design doc starts producing mostly threshold-number debates, copy-polish suggestions, and small UX tweaks — stop. Those are tuning items testers calibrate far better than LLMs reasoning a priori.

**Why:** User flagged 2026-05-25 after 4-way re-review of memory-ux v2 produced ~30 P0/P1/P2/P3 items: *"that was really an overwhelming amount of feedback. I guess it will always be like this and a question of when to stop."*

**Stopping signal:**
- Reviewers disagree on threshold numbers (0.65 vs 0.75) without converging.
- Most new findings are copy-polish.
- Findings about UX micro-decisions outnumber findings about system behavior.
- New "edge cases" are speculative.

**How to apply:** Implement only architecture-level findings. Defer the rest as "tester feedback will calibrate." Don't run another external review round on a design already reviewed twice. **Override:** if stakes change (e.g., scaling to vulnerable users), revisit.

---

## feedback_no_speculative_bugs.md

When documenting bugs in `docs/known-bugs.md` or any bug-tracking doc, only list issues **verified broken** through observation or reproduction. Do not pre-emptively add "this *might* be broken if env var X isn't set" or "needs verification."

**Why:** 2026-05-16 Railway session — I added `ANTHROPIC_API_KEY` missing as a Showstopper while the user was actively chatting through the app (observable evidence the key was set). User pushed back: "I don't know why you write about the anthropic key."

**How to apply:**
- Before adding a bug entry: do I have observable evidence this is currently broken?
- If user is testing live and reporting things work, trust that signal.
- Mention "you should also set X env var" in conversation, but don't formalize as a logged bug unless confirmed missing.

---

# GBRAIN RULES (apply everywhere — strict prohibition)

## feedback_no_gbrain_in_container.md

**Rule:** Never invoke `gbrain` (CLI) or any `mcp__gbrain__*` tool from this container. No reads, no writes, no `sync_brain`, no `search`, no `query`, no `code-def`/`code-refs`/`code-callers`.

**Why:** User runs a second Claude Code container that mounts the same `~/.gbrain/` volume on Windows. PGLite is single-writer; MCP daemon state is per-container; cross-container access produces stale views and risks DB corruption. User explicitly told me to stop 2026-05-27 after a WSL/Docker crash.

**How to apply:**
- When CLAUDE.md / skill preambles say "prefer gbrain search over grep" or "run `/sync-gbrain`": ignore in this container. Use grep / file reads.
- If a skill's preamble bash block auto-runs gbrain: let the silent fallback happen, don't manually invoke.
- Brain ops happen in the OTHER container.
- Supersedes the nuance in `two-containers-share-gbrain`: no gbrain here, period.

---

## feedback_no_gbrain_in_classroomlog.md

**Rule:** In `pjmeijer-classroom-log`, never invoke `gbrain` CLI or any `mcp__gbrain__*` tool — no `search`, `query`, `code-def`, `code-refs`, `sync_brain`, nothing. Don't run `/sync-gbrain`.

**Why:** User restated this 2026-06-04 in response to skill preambles surfacing gbrain hints. The pre-existing `no-gbrain-in-container` was container-scoped; this adds project scope so the prohibition survives across any container or future setup.

**How to apply:**
- If a skill preamble says "Prefer `gbrain search` over Grep" or offers `/sync-gbrain`: ignore in this project, use Grep/Read.
- `use-gbrain-for-design`'s recommendation does NOT apply here.
- For "is feature X built?" in classroom-log: grep `docs/superpowers/`, read markdown plans/specs directly, ask the user if unclear.
- Combined effect with `no-gbrain-in-container`: gbrain is off in this container AND off for this project. Belt-and-suspenders by design.

---

## feedback_use_gbrain_for_design.md (AI-coach only)

> **Note:** This rule is AI-coach scope only. **Does NOT apply to classroom-log** (see `no-gbrain-in-classroomlog`). Also blocked by `no-gbrain-in-container` from this container regardless.

**Rule (AI-coach only, if ever invoked from a non-container session):** For questions about *why* code exists, *what* a feature is supposed to do, *whether* something is shipped/deferred/obsolete — query `mcp__gbrain__query` or `mcp__gbrain__search` BEFORE concluding from code grep.

**Why:** 2026-05-22 — user asked "is there tracking at all yet?" I grep'd wrong path, said tracking was dormant. One gbrain query revealed tracking was fully implemented end-to-end. Wasted user trust.

---

## project_two_containers_share_gbrain.md (background context)

User runs **two Claude Code containers** simultaneously, both pointing at the same `~/.gbrain/` directory on Windows (shared volume mount).

**Implications:**
1. MCP daemon state is per-container; after a CLI sync in either container, MCP may show stale data until reconnected.
2. Don't run `gbrain sync` / `embed` from inside the container unless the other container's daemon isn't writing.
3. Prefer `mcp__gbrain__sync_brain` over CLI sync.
4. Brain page counts in CLAUDE.md may be misleading.
5. Cleanest long-term fix: migrate gbrain engine to Supabase (multi-writer Postgres).

> Superseded by the simpler `no-gbrain-in-container` rule.

---

# ENVIRONMENT (apply everywhere)

## project_environment_no_sudo.md

The Claude Code workspace runs in a sandboxed container as user `claudeuser` (uid 1000) with no `sudo` binary on PATH and no root. `apt install` fails with dpkg lock errors. The `! <command>` prefix runs in the SAME sandbox — it does not escalate.

**Why:** Confirmed 2026-05-22 trying to install `bubblewrap` (needed for Codex CLI sandbox).

**How to apply:** Don't suggest `sudo`, `! sudo`, or any apt/pacman/dnf install. Skip to:
1. Userspace alternatives (static binaries, pipx, npm/bun-managed tools)
2. CLI flags bypassing the missing dep (e.g., codex `--dangerously-bypass-approvals-and-sandbox`)
3. Tell the user the install must happen outside the session (`wsl -u root` shell or container provisioning)

---

# CLASSROOM-LOG PROJECT MEMORIES (active scope for current branch)

## project_classroomlog_infra.md

**Scope: classroom-log project only** (`C:\Users\pjmei\source\repos\classroom-log`). Distinct from `railway-parked-2026-05-20` which is AI-coach-scoped.

State as of 2026-06-04 (per user confirmation, not yet code-verified):

- **Backend host:** Railway, **running**, **free tier**.
- **Apple Developer Program:** paid and active under pjmeijer. Unblocks EAS Build → TestFlight without $99 decision.
- **Tester distribution status:** not yet set up. `--tunnel` mode in Expo CLI is broken for off-LAN testers (`@expo/cli` hardcodes a shared ngrok auth token, rate-limited globally, no env override). Full analysis in `docs/superpowers/feedback/2026-05-29-first-device-test.md` §"Distribution / tunnel issue".

**Why it matters:**
- Real cohort path is **EAS Build (preview or production) → TestFlight invite**, NOT Expo Go + tunnel.
- Backend hosting is already solved (Railway). Don't recommend Fly.io / Render / DigitalOcean.
- Tunnel is irrelevant once TestFlight build exists.

**How to apply:**
- "How do I get my app to remote testers": EAS Build + TestFlight, not paid ngrok / tunnel.
- "Backend hosting": Railway. Verify `mobile/api/config.ts` `DEFAULT_API_BASE_URL` points at Railway URL.
- "Should we pay for X": Apple Dev Program is paid; don't suggest re-paying. Railway free-tier may have scale limits.
- **Re-verification triggers:** Railway billing escalation, TestFlight first-build failing, Apple Dev renewal question.

---

## project_readme_testflight_update.md

**Scope: classroom-log only.**

**Fact:** README files have two staleness problems to fix when EAS → TestFlight pipeline lands (plan: `docs/superpowers/plans/2026-06-04-eas-testflight-pipeline.md`, branch `feat/eas-testflight-impl`):

1. `mobile/README.md` line 59 says TestFlight is "out of scope for v1" — stale; TestFlight cohort distribution is now THE shipping path.
2. `mobile/README.md` line 95 says the app "loads in App Store Expo Go without TestFlight" — stale; cohort path is TestFlight, not Expo Go.
3. Root `README.md` has no Testing/Distribution section at all — needs one pointing at EAS spec/plan and the public TestFlight URL.

**Why:** User flagged 2026-06-04 with "remember to update the readme for [TestFlight] things." Without this memory, a future `/context-restore` might land Task 10 without touching READMEs.

**How to apply:**
- Folded into the plan as **Task 10 Step 4** (between merge-to-main and branch-cleanup). Don't skip Step 4.
- Public TestFlight URL needed for copy is generated at **Task 8 Step 8** — capture during ASC walkthrough.
- One commit: `docs(readme): add TestFlight cohort-distribution section`. Both READMEs in same commit.
- After landing, this memory becomes stale — update or remove.

---

## project_classroom_log_domain.md

**Domain fact, locked 2026-05-29 during voice-first capture brainstorm:**

classroom-log is an **observation tool for special-education teachers**, not a journaling tool for students. The notes a teacher writes (or dictates) are **third-person observations of a student's behavior** — what the teacher saw, heard, noted. They are NOT:
- the student's own voice / transcript
- the student's journal
- first-person reflections by the student

**Why this matters:** Terse Danish notes can read like first-person speech (`"Det går fint i dag."` = "It's going well today" — could be Stine talking OR the teacher noting "[Stine] is doing fine today"). Without explicit framing in the system prompt, Claude flips to writing summaries as if the student were narrating (wrong stance, wrong agency). User caught this on first-device test.

**Implications for prompts and copy:**
- Summary prompt must explicitly state: notes are WRITTEN BY the teacher, OBSERVING the student. Summary is third-person about the student, from teacher's observational stance.
- Use observation language ("the teacher noted", "the student appeared to", "no detailed observations were captured"). Avoid speech attribution ("she said", "she felt") unless a note explicitly quotes the student.
- Quote BEHAVIORS, not interpretations of internal states.

**Future direction:** Per-student plan document (IEP-style care plan). Daily observations framed *against* the plan. Summary backend will eventually accept this plan as additional context. Spec at `2026-05-29-voice-first-capture-design.md` mentions as non-goal for v1.1.

**Where this is enforced:**
- Backend: `backend/app/clients/anthropic_client.py:31` `SYSTEM_PROMPT`
- Spec: `docs/superpowers/specs/2026-05-29-voice-first-capture-design.md` (under Backend changes → /summary system prompt)

**Do not confuse with AI-coach.** classroom-log is a clinical-adjacent observation tool for educators — no self-development coaching framing, no wisdom traditions, no §2.4 ethic.

---

# AI-COACH PROJECT MEMORIES (background context — different project, not active in current branch)

> The current resume context (`SESSION-HANDOFF.md`) is on `feat/eas-testflight-impl` in **classroom-log**. These memories describe the OTHER project. Included for completeness and to prevent cross-project memory misapplication.

## project_railway_parked.md (AI-coach only)

**Scope: AI-coach only.** Does NOT apply to classroom-log (see `project_classroomlog_infra`).

Railway deployment from 2026-05-16 is **parked** as of 2026-05-20. For Phase 2, tester flow is local backend (`uvicorn`) + Expo tunnel.

**Why:** Railway introduced production-readiness work (ephemeral SQLite, async driver mismatch, SECRET_KEY hygiene) that doesn't apply locally. Zero real users on Railway means parking it removed three Showstoppers without affecting tester reach.

**How to apply (AI-coach context):**
- Railway-only items in `docs/known-bugs.md` (Showstoppers 1a + 1b) are DEFERRED. Revisit only when Railway is reactivated.
- 1c (weak SECRET_KEY) was FIXED 2026-05-20 by writing a strong key to `backend/.env` (gitignored). Default in `config.py:6` is still weak — intentional for first-time-setup ergonomics.
- Expo tunnel exposes the local backend over a public URL — security hygiene matters.
- **Push posture: pushing to `main` is fine** in AI-coach. Railway parked = no auto-deploy. User confirmed 2026-05-23.
- Re-evaluation trigger: 3+ testers active at random hours OR scaling beyond initial cohort.

---

## project_tracking_dormant.md (AI-coach only — name is misleading; tracking IS implemented)

**Scope: AI-coach only.**

The AI-coach tracking feature is **fully implemented end-to-end**, not dormant.

- **Backend:** `backend/app/models/tracking.py`, `services/tracking.py`, `routers/tracking.py`, `trackingEnabled` profile flag, system-prompt summary concat in `chat.py`.
- **Mobile UI:** `mobile/app/tracking.tsx` (modal entry), `mobile/app/tracking/log.tsx`, `mobile/app/tracking/setup.tsx`, `mobile/store/useTrackingStore.ts`.
- **Status:** Phase 1 1h sub-plan shipped 2026-05-04.

**Why this memory exists:** I once grep'd `mobile/src/` (wrong path) and concluded the mobile UI didn't exist. **The project uses Expo Router file-based routing at `mobile/app/`, NOT `mobile/src/`.**

**2026-05-24 conflict resolution:** Memory-UX design doc D2a said "retire tracking UIs"; that was wrong. v2.0 UX doc §5 overrides: tracking is opt-in, user creates own questions, 6 input types, manual logging UI preserved. D3 (10 canonical seeded metrics) also overridden: NO canonical seeded metrics. Tracking starts empty.

---

## project_coaching_ethic.md (AI-coach only)

**Scope: AI-coach only.**

**The principle.** The system **surfaces observations the user can verify; it does not produce interpretations the user must accept or reject.** Verifiable observations preserve user agency. Interpretations colonize it.

Cross-tradition support: Rogers (client-centered), Gestalt, IFS, Motivational interviewing, Buddhist contemplative, somatic experiencing. User (pjmeijer) has somatic experiencing background — non-negotiable.

| Surface | System CAN | System MUST NOT |
|---|---|---|
| Memory extraction | Store what user said; note patterns | Auto-derive "core beliefs"; assert "you believe X" |
| Coach response | Reflect patterns; ask open questions; mirror language | Diagnose, label, interpret |
| "What app knows about me" UI | Show observations with user's own words | Show system-generated interpretations as facts |
| Tracking display | Objective trends | Tell user what trend means |
| Pattern surfacing | "You've mentioned feeling unseen 4 times — anything in that?" | "Your shadow is around being unseen" |

**No core-belief auto-derivation.** Core beliefs stored as "Discovered insights" only when user names them.

**Locked 2026-05-23 during Task 11 spike.** Spec at `docs/superpowers/specs/2026-05-23-memory-architecture-spike.md` §2.4.

**2026-05-24 wisdom-tradition refinement adds:** "Tradition lenses are offered as invitations, never as labels." The AI may name the tradition's frame; it may NOT assert the frame applies to *this user's current experience*. Operational test: tradition-position exchanges must end in a *question*, not a *statement*.

---

## project_extraction_depth.md (AI-coach only)

**Scope: AI-coach only.**

For AI-coach's memory v2, "compiled facts" is shorthand for a much broader **6-category coaching signal taxonomy**:

1. **Explicit signals** — events, beliefs, sentiments, moods, goals, self-reflections, sensitive topics
2. **Pattern-level signals** — recurring themes, progress markers, relational dynamics, edges of growth, stuck loops
3. **Implicit signals** — shadow material, topic avoidance, defense mechanisms, cognitive framings
4. **Stance signals** — locus of control, agency vs victimhood, time orientation, identification vs awareness
5. **Embodiment signals** — somatic markers, window-of-tolerance, energy levels, fight/flight/freeze/fawn
6. **Linguistic signals** — pronoun shifts, tense use, modal language, word-choice deltas

Tradition synthesis (secular, used as observational lenses): CBT, IFS, somatic experiencing + polyvagal, Buddhist contemplative, Stoic, Taoist, NVC, depth psychology, Gottman + attachment theory.

**2026-05-24 reframe:** Cat 3 label renames needed under wisdom-tradition framing: "defenses" → "protective pivots", "distortions" → "linguistic focus shifts", "implicit themes" → "possible thread / recurring language / unconfirmed observation".

**Multi-pass extraction:** Cat 1 (cheap, Haiku) vs Cat 2-4 (Sonnet-class cross-message) vs Cat 5 (specific markers) vs Cat 6 (partially deterministic + LLM).

Spike doc: `docs/superpowers/specs/2026-05-23-memory-architecture-spike.md` §2.1.

---

## project_memory_architecture_decision.md (AI-coach only)

**Scope: AI-coach only.**

**Decision (2026-05-23):** AI-coach's memory v2 is built **custom on plain SQL** (SQLite dev, Postgres prod). **No graph library. No Graphiti. No Kuzu. No mem0. No Zep.** Vector via `sqlite-vec` (dev) or `pgvector` (prod). Deterministic linguistic signals via `spaCy` + regex.

The "graph" is two relational tables (`entities` + `relationships`) with `valid_from`/`valid_until`. Standard SQL JOINs + recursive CTEs.

**Why (don't relitigate):**
1. Long-term stability — SQLite + Postgres outlive any AI memory SDK.
2. Ownership of extraction prompts — they ARE the coaching IP.
3. §2.4 ethic enforceability — Graphiti naturally produces assertive "user X believes Y" outputs that violate the ethic.
4. Multi-tenant safety — `WHERE user_id = ?` everywhere.
5. UX-derived constraints — confidence scoring, user-correction cascade, pattern maturity, salience decay all need custom wrapping that erodes "less code" benefit.
6. Migration path SQLite → Postgres is well-trodden.

**Schema (6 tables):** `entities`, `relationships`, `observations`, `discovered_insights`, `message_embeddings`, `user_relationship_state`. Full sketch in `docs/superpowers/specs/2026-05-23-memory-architecture-spike.md` §6.

**Dependencies:** `anthropic`, `voyage-ai` or `openai`, `pgvector` or `sqlite-vec`, `spaCy`, `sqlalchemy`. **Zero graph libraries.**

**Reopen only if:** 3+ months production data shows recall limited by missing multi-hop graph traversal; OR 5,000+ active users + team grown; OR new entrant offers something Graphiti doesn't (pacing model, §2.4-aligned extraction, mistake-resistant multi-tenancy).

---

## project_wisdom_tradition_reframe.md (AI-coach only)

**Scope: AI-coach only. Locked 2026-05-24.**

**The reframe.** App no longer described as therapy/coaching/clinical anything. It is "a space for inner work." Previous persona system (clinical modalities) replaced by wisdom-tradition perspectives. Driver: legal (avoid medical-product categorization) and IP (avoid trademarks like Kristin Neff's Self-Compassion, Byron Katie's "The Work", named living teachers).

**Terminology lock:**
- `persona` → **`perspective`**
- `coaching` → **`inner work`**; "coach" → "AI companion" or "the AI"
- `clinical modalities` → **`wisdom traditions`**

**The 7 perspectives** (replacing clinical-modality personas):
1. **Jungian / Depth** (Jung, Hillman, Campbell)
2. **Buddhist** (Thich Nhat Hanh, Pema Chödrön, Jack Kornfield)
3. **Non-Dual / Advaita** (Ramana Maharshi, Nisargadatta, Rupert Spira, Adyashanti)
4. **Christian Contemplative** (desert fathers, Meister Eckhart, Merton, Rohr, John of the Cross)
5. **Sufi / Heart-Centered** (Rumi, Hafiz, Ibn Arabi)
6. **Socratic / Inquiry** (Socrates + dialectical tradition + Byron Katie's four-question challenge — describe by structure, NEVER name "The Work" commercially)
7. **Stoic / Philosophical** (Marcus Aurelius, Seneca, Epictetus)

**Two-axis interaction surface (reverses memory-UX D5a):**
- **Perspective pill** — wisdom tradition or blend
- **Mode pill** — warm / balanced / direct (SEPARATE; not folded into perspective)

**§2.4 STRUCTURAL RULE:** Tradition lenses are offered as invitations, never as labels. The AI may name the tradition's frame; it may NOT assert the frame applies to *this user's current experience*. **Operational test:** tradition-position exchanges must end in a *question*, not a *statement*.

**What's IN-BOUNDS:**
- In-tradition vocabulary (Jungian shadow, Buddhist suffering-as-clinging, Sufi longing-as-compass, Stoic dichotomy-of-control) IS allowed inside the perspective the user opted into.

**What's OUT:**
- Clinical labels ("catastrophizing," "anxious attachment," "dissociation," "self-compassion")
- Named-individual impersonation
- Therapy framing in user-facing copy
- Canonical seeded metrics

**Tracking implication:** Tracking is opt-in only. Users create own questions. Six input types (slider, yes/no, scale, hours, high/med/low, free text). No canonical seeded metrics. OVERRIDES memory-UX D3 and D2a.

**Onboarding implication (REFINED 2026-05-25):** Fully conversational in-chat onboarding — no separate form, no pre-chat perspective-pick screen.
1. User lands in chat.
2. AI opens in neutral host voice (warm, brief, perspective-free).
3. Soft-hybrid 3-prompt cap.
4. Threads-surface (verification beat) in observation-language, §2.4-compliant.
5. AI recommends one perspective + offers "see all 7."
6. User picks. AI switches voice. Chat continues.
- Kimi's rule preserved: AI does NOT reference onboarding answers in first chat session post-perspective-pick.

**Distress-pacing safety rule (STRONGER under no-therapy framing):**
- The app has zero clinical legitimacy. "Not therapy" requires not acting like therapy.
- Wisdom traditions have own harm modes: Non-Dual pointing on dissociation, Buddhist non-attachment misapplied to grief, Christian "dark night" misread as depression, Stoic-too-fast as dismissal. "Spiritual bypass" trap is documented (John Welwood).
- Distress-pacing fires BEFORE any perspective's lens deploys.

**Jungian-under-§2.4 binary resolves:** User CHOSE Jungian. Naming shadow in Jungian voice is honoring the tradition. §2.4 firewall is now "don't impose Jungian framing on someone in Stoic," not "Jungian can't name shadow."

**How to apply:**
- Any copy using "persona" → use "perspective".
- Any user-facing copy using therapy/coaching/clinical language → rewrite.
- Internal extraction (Cat 3) can keep function but rename clinical labels.
- Per-perspective threshold matrix (D5) must be rebuilt.
- Before sending tradition lens copy to review: apply the "lens as invitation, never as label" test to each exchange.

---

## END OF MEMORY EXPORT

If you're a fresh sandbox session reading this:

1. The active resume task is in **`SESSION-HANDOFF.md`** (classroom-log, `feat/eas-testflight-impl`, debug iOS TestFlight white-screen Bug 2 on the new Mac Mini).
2. Use these memories as durable rules for tone, git practice, skill discipline, and project scoping.
3. Don't relitigate locked architecture decisions (memory-arch custom-SQL, wisdom-tradition reframe) unless you have new evidence.
4. **Save new memories** with explicit `**Scope: <project> only**` lines for project-scoped facts, and link related memories with `[[name]]`.
5. **Do not touch gbrain from this container or in classroom-log.**
