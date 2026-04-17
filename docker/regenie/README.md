# docker/regenie — thin artifact image

## Purpose

Phase 14 thin artifact image. The binaries produced in this image are consumed
by Darkstar (`docker/r/Dockerfile`) via a multi-stage `COPY --from=parthenon-regenie`
layer added in Phase 14 Wave 4. This image is **never** executed as a long-lived
service — it exists solely to produce two pinned binaries in a reproducible,
HIGHSEC-compliant way.

## Version pins

| Binary  | Version         | Released    | License | Source                                                                |
|---------|-----------------|-------------|---------|-----------------------------------------------------------------------|
| regenie | v4.1            | 2025-01-27  | MIT     | https://github.com/rgcgithub/regenie/releases/tag/v4.1                |
| plink2  | alpha 6.33      | 2026-02-28  | GPLv3   | https://s3.amazonaws.com/plink2-assets/plink2_linux_avx2_20260228.zip |

Rationale for these pins is captured in `.planning/phases/14-regenie-gwas-infrastructure/14-RESEARCH.md`
sections A1 (regenie v4.1) and A2 (plink2 alpha 6.33). D-01 of `14-CONTEXT.md`
locks these versions for the Phase 14 milestone.

## Bump procedure

1. Discover the new upstream release URL.
2. Run `curl -I <new-url>` and confirm an HTTP 200 response.
3. Update the corresponding `ARG` line in this Dockerfile.
4. Rebuild: `docker build --no-cache -t parthenon-regenie:<new-ver> docker/regenie/`
5. Smoke test the new binaries once Darkstar consumes them:
   `docker compose exec darkstar /opt/regenie/regenie --version`
   `docker compose exec darkstar /opt/plink2/plink2 --version`
6. Record the bump in `.planning/phases/<phase>/<phase>-RESEARCH.md` along with
   any backward-incompatible flag changes (regenie's CLI has churned in the
   v3 → v4 transition — review the upstream changelog before a major bump).

## Security notes

* The final stage explicitly creates `svcgroup` / `svcuser` (system user, no
  login shell) and declares `USER svcuser` per HIGHSEC §4.1. A `docker run`
  against this image will run as a non-zero UID.
* Binaries are sourced from the official upstream release assets over HTTPS
  (GitHub release + S3 asset bucket). Supply-chain surface is captured as
  T-14-01 in the Phase 14 threat register.
* Future hardening (tracked for v1.1 in `14-RESEARCH.md` §Threat Model): pin
  SHA-256 checksums for both downloads and verify at build time before
  extracting. For v1.0 we accept the TLS-only integrity guarantee, since the
  build is audited and the binaries are copied into Darkstar by a controlled
  multi-stage layer.

## Build command

```bash
docker build -t parthenon-regenie:v4.1 docker/regenie/
```

## Consumed by

* `docker/r/Dockerfile` — adds a `COPY --from=parthenon-regenie /opt/regenie /opt/regenie`
  layer (and the equivalent for plink2) in Phase 14 Wave 4. At that point the
  Darkstar image carries both binaries on its `PATH` and can execute GWAS
  workloads without running this image directly.

## Not in this image

* No docker-compose service definition. D-23 resource limits and compose
  wiring happen in Phase 14 Wave 4 when the binaries are actually consumed
  by Darkstar — this image is the build-time artifact only.
* No `ENTRYPOINT`. Consumers set their own entrypoint when they `COPY --from`
  these binaries into their own image.
