---
description: Rules for instant session continuity across restarts and zero-friction resume
globs: ["*"]
---

# Session Continuity & Zero-Friction Resume Rules

1. **Check `ACTIVE_SESSION.md` on Start**:
   - At the beginning of any session or when the user says "I'm back", "let's pick up", or restarts, immediately read [ACTIVE_SESSION.md](file:///c:/Users/15034/Projects/ResaleCommand/ACTIVE_SESSION.md) using `view_file`.
   - Never run shell commands (e.g. `Get-Content`, `dir`, `git log`) to probe what was happening—terminal commands trigger user-facing permission approval modals that slow the user down.

2. **Use File Tools Over Terminal Commands**:
   - Use `view_file`, `write_to_file`, `replace_file_content`, and `grep_search` directly. They execute instantly and silently without triggering annoying permission prompts.
   - Reserve `run_command` only for actual build/test tasks when requested.

3. **Keep `ACTIVE_SESSION.md` Updated**:
   - When completing tasks, changing active items, or updating goals, update [ACTIVE_SESSION.md](file:///c:/Users/15034/Projects/ResaleCommand/ACTIVE_SESSION.md) so the user never has to re-explain context when resuming.
