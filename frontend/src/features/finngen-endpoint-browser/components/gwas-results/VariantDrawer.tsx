// Phase 16 Plan 05 Task 2 — VariantDrawer (D-12).
//
// Per-row slideover dialog showing all 10 fields from the top-variants API
// payload: chrom, pos, ref, alt, af, beta, se, p_value, snp_id, gwas_run_id.
// Formatting matches TopVariantsTable:
//   - pos: locale-formatted with thousands separators
//   - af: 4 decimals
//   - beta / se: 3 decimals
//   - p_value: "<1e-300" or scientific notation with 2 decimals
//   - gwas_run_id: tail-6 mono-font short-code (title attribute holds full id)
//
// role="dialog" + aria-modal="true" per T-16-S11 mitigation; React auto-
// escapes every field value — no dangerouslySetInnerHTML anywhere.
//
// Returns null when variant prop is null so the parent can do <Drawer
// variant={drawerVariant} /> without conditional wrapping.
import type { TopVariantRow } from "../../api/gwas-results";

export interface VariantDrawerProps {
  variant: TopVariantRow | null;
  onClose: () => void;
}

function formatPValue(p: number): string {
  return p < 1e-300 ? "<1e-300" : p.toExponential(2);
}

export function VariantDrawer({
  variant,
  onClose,
}: VariantDrawerProps): JSX.Element | null {
  if (variant === null) return null;

  const runIdTail = variant.gwas_run_id.slice(-6);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Variant detail"
      className="fixed right-0 top-0 z-50 h-screen w-96 overflow-y-auto border-l border-border bg-surface p-4 shadow-xl"
      data-testid="variant-drawer"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Variant Detail</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close drawer"
          className="rounded px-2 text-text-muted hover:text-text-primary"
        >
          {"\u00D7"}
        </button>
      </div>
      <dl className="space-y-1 text-xs">
        <div>
          <dt className="inline text-text-muted">Chr: </dt>
          <dd className="inline" data-testid="drawer-chrom">
            {variant.chrom}
          </dd>
        </div>
        <div>
          <dt className="inline text-text-muted">Pos: </dt>
          <dd className="inline" data-testid="drawer-pos">
            {variant.pos.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="inline text-text-muted">Ref: </dt>
          <dd className="inline" data-testid="drawer-ref">
            {variant.ref}
          </dd>
        </div>
        <div>
          <dt className="inline text-text-muted">Alt: </dt>
          <dd className="inline" data-testid="drawer-alt">
            {variant.alt}
          </dd>
        </div>
        <div>
          <dt className="inline text-text-muted">AF: </dt>
          <dd className="inline" data-testid="drawer-af">
            {(variant.af ?? 0).toFixed(4)}
          </dd>
        </div>
        <div>
          <dt className="inline text-text-muted">{"\u03B2: "}</dt>
          <dd className="inline" data-testid="drawer-beta">
            {(variant.beta ?? 0).toFixed(3)}
          </dd>
        </div>
        <div>
          <dt className="inline text-text-muted">SE: </dt>
          <dd className="inline" data-testid="drawer-se">
            {(variant.se ?? 0).toFixed(3)}
          </dd>
        </div>
        <div>
          <dt className="inline text-text-muted">P: </dt>
          <dd className="inline font-mono" data-testid="drawer-p">
            {formatPValue(variant.p_value)}
          </dd>
        </div>
        <div>
          <dt className="inline text-text-muted">SNP ID: </dt>
          <dd className="inline font-mono" data-testid="drawer-snp">
            {variant.snp_id ?? "\u2014"}
          </dd>
        </div>
        <div>
          <dt className="inline text-text-muted">Run ID: </dt>
          <dd
            className="inline font-mono"
            title={variant.gwas_run_id}
            data-testid="drawer-run"
          >
            {"\u2026"}
            {runIdTail}
          </dd>
        </div>
      </dl>
    </div>
  );
}
