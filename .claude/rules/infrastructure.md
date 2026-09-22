---
paths:
  - "infra/alchemy.run.ts"
  - "infra/**/*"
  - ".github/workflows/**/*"
  - "scripts/deploy-*.ts"
---

# Infrastructure

- Alchemy v2 in `infra/alchemy.run.ts` is the composition root. Its workspace
  owns the Alchemy-compatible Effect runtime; application packages do not import it.
- Production uses the explicit `prod` stage. PR stages are isolated and may
  own stable `p<PR>.planner.phibkro.org` hostnames.
- Resolve exact stages and resources before deploy or destroy operations.
- Preview cleanup must refuse the production stage.
- Infrastructure follows a demonstrated product need. Prefer the smallest
  reversible resource change that supports the current slice.
