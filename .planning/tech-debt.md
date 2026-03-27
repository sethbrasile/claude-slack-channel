# Tech Debt Registry

**Source:** Quality cycle 2026-03-27 → 2026-03-27 (1 round)
**Verdict:** SHIP IT

## Unaddressed Findings

### Architecture (effort: S)
| Severity | Description | Source Review | Notes |
|----------|-------------|--------------|-------|
| low | Unknown tool `isError` vs MCP protocol error — reply tool returns `isError: true` for unknown tools instead of raising a proper MCP protocol error | 2026-03-27 | QC-1-20. Cosmetic — current behavior is functional but deviates from protocol semantics. |
