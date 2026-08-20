# How to use this rules set

Copy the whole `.cursor/rules/` folder into the root of any project. Cursor picks it up automatically — no config needed.

**Files and how they load:**
| File | Mode | Loads when |
|---|---|---|
| 00-persona-and-planning | alwaysApply | every request |
| 01-safety-guardrails | alwaysApply | every request |
| 02-testing-requirements | agent-requested | agent judges it's a coding/testing task |
| 03-security-standards | agent-requested | agent judges it's touching input/auth/data/network |
| 04-git-workflow | agent-requested | agent judges it's a commit/PR/branching task |
| 05-tech-stack-conventions | auto-attached | any `.ts`/`.tsx`/`.graphql`/prisma/schema file is open |
| 06-code-style | alwaysApply | every request |
| 07-communication-and-reporting | alwaysApply | every request |

**Per-project tweaks to make each time you copy this in:**
- `05-tech-stack-conventions.mdc` — swap Supabase/Neon/GraphQL for whatever that specific project actually uses if it differs.
- If the project doesn't use a `preview` branch, adjust `04-git-workflow.mdc`'s branch names.

**Judgment calls made while writing these** (override if you disagree):
- Split "hardcore testing" into per-change tests (always) vs. full regression pass (only on explicit request / before release) — running a full suite on every keystroke isn't sustainable on cost or time.
- Security rule is agent-requested, not always-applied, so it doesn't eat context budget on non-code chat turns — it still fires for anything touching input/auth/data.
- Kept the four `alwaysApply` files short by design (each under ~150 words) since those tokens are spent on *every single message*.
