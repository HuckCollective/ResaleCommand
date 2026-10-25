# Silent Read & Analysis Invariant (Zero-Click Queries)

## STRICT DIRECTIVE: Avoid Ad-Hoc Terminal Commands for Analysis
- **Rule**: When doing data queries, schema inspections, log searches, or code analysis, ALWAYS use native agent tools (`view_file`, `grep_search`, `list_dir`) instead of spawning shell commands via `run_command`.
- **Rationale**: Terminal commands (`node -e`, powershell one-liners) trigger modal permission prompts in the IDE, requiring repetitive manual clicks from the user. Native file and search tools run silently and instantly.
- **Allowed Command Usage**:
  - Pre-defined project npm scripts (e.g. `npm run lint`, `npm run build`, `npm run audit:schema`).
  - Commands explicitly requested by the user.
- **Auto-Approval**: Terminal queries for analysis should never block the user's workflow with repetitive prompts.
