# Consensus

## Why this requires consensus

A single centralized agent evaluating "Is this project actively maintained and publicly attributable?" can favor borrowers, suppress inconvenient evidence, or fabricate excerpts.

GenLayer validators independently:
1. Fetch all declared public sources
2. Evaluate four operational dimensions
3. Cross-check the leader's evidence excerpts
4. Reject if material dimension bands disagree by more than one level

The resulting operational review is stored on-chain and drives real credit capacity.

## Dimensions

| Dimension | Question |
|---|---|
| `MAINTENANCE_ACTIVITY` | Is there recent, verifiable maintenance activity (commits, releases, dates)? |
| `OWNERSHIP_ATTRIBUTION` | Is there clear, verifiable attribution of who operates/owns this project? |
| `PUBLIC_CONTINUITY` | Is the project demonstrably operational and publicly accessible right now? |
| `TRANSPARENCY` | Is the project open about its state, issues, and history? |

Each dimension is assigned: **STRONG**, **MODERATE**, **WEAK**, or **UNRESOLVED**.

## Leader/validator pattern

```python
def leader_fn():
    evidence = _fetch_and_evaluate(source_list, project_name)
    return evidence

def validator_fn(leader_result) -> bool:
    if not isinstance(leader_result, gl.vm.Return):
        return False
    candidate = leader_result.calldata
    if not _valid_review_shape(candidate):
        return False
    # Independent fetch
    my_findings = _fetch_and_evaluate(source_list, project_name)
    # Compare material dimension bands
    for dim in ("maintenance", "attribution", "continuity", "transparency"):
        c_val = candidate.get(dim, "UNRESOLVED")
        m_val = my_findings.get(dim, "UNRESOLVED")
        # Allow at most one level difference
        order = ["UNRESOLVED", "WEAK", "MODERATE", "STRONG"]
        if abs(order.index(c_val) - order.index(m_val)) > 1:
            return False
        # Verify evidence excerpts are present and non-trivial
        leader_evidence = candidate.get("evidence", [])
        dim_excerpts = [e for e in leader_evidence if e.get("dimension") == dim]
        if not dim_excerpts or len(dim_excerpts[0].get("excerpt", "")) < 10:
            return False
    return True

result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
```

## What validators reject

- Missing evidence for any dimension
- Evidence excerpts shorter than 10 characters
- Dimension bands that diverge by more than one level from independent evaluation
- Malformed output (not matching the expected JSON schema)

## What validators cannot reject

- Reason prose differences (validators may write different reasons)
- Minor band differences within one level (e.g., STRONG vs MODERATE)

## Evidence standards

- Must quote verbatim text from fetched sources
- Must not rely on GitHub star/follower counts alone
- Must not trust user-authored profile summaries as primary evidence
- Sources are fetched with a 8192-byte limit and content truncated to 4096 bytes per source

## Abstention behavior

If sources are unavailable or evidence is insufficient:
- Dimensions are set to `UNRESOLVED`
- Credit band derives to `NONE`
- No loan is possible with NONE band

No loan is ever forced when evidence cannot support it.

## Review freshness

Reviews are valid for 30 days. After expiry:
- `review_is_fresh()` returns false
- `profile_credit_band()` returns NONE
- Vault blocks new borrows until a fresh review is obtained

Past repayment history does NOT override a stale review.
