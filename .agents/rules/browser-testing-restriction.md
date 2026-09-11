# Browser Testing & Screenshot Restriction

## STRICT DIRECTIVE: Do Not Launch Browser Subagents or Take Screenshots
- **Rule**: Never invoke `browser_subagent`, launch automated browser instances, or take screenshots unless the user explicitly asks for browser testing or screenshots in their prompt.
- **Rationale**: Automated browser execution and screen recording create high resource overhead that degrades performance and crashes the user's PC.
- **Verification Alternative**: 
  - Validate changes via static analysis, code inspection, type checks, or terminal build scripts (`npm run build`).
  - Provide manual verification steps for the user to check in their already running browser session when needed.
