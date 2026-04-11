"""Propensity score matching service.

Fits L1-regularized logistic regression on OMOP covariates from
patient_feature_vectors, performs nearest-neighbor matching within caliper,
computes preference scores and before/after balance diagnostics.
"""

import logging
from typing import Any

import numpy as np
from numpy.typing import NDArray
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score

logger = logging.getLogger(__name__)


class PropensityScoreService:
    """Propensity score estimation, matching, and balance diagnostics."""

    @staticmethod
    def build_feature_matrix(
        target_features: list[dict[str, Any]],
        comparator_features: list[dict[str, Any]],
    ) -> tuple[NDArray[np.float64], NDArray[np.int64], list[str]]:
        """Build a sparse binary/continuous feature matrix from patient feature dicts.

        Returns (feature_matrix, labels, feature_names) where:
        - feature_matrix is (n_patients, n_features) float array
        - labels is (n_patients,) int array (1=target, 0=comparator)
        - feature_names lists feature column names
        """
        all_features = target_features + comparator_features
        labels = np.array(
            [1] * len(target_features) + [0] * len(comparator_features),
            dtype=np.int64,
        )

        # Collect all concept IDs across both groups for binary columns
        condition_ids: set[str] = set()
        drug_ids: set[str] = set()
        procedure_ids: set[str] = set()
        lab_ids: set[str] = set()

        for feat in all_features:
            for cid in (feat.get("condition_concepts") or {}):
                condition_ids.add(str(cid))
            for cid in (feat.get("drug_concepts") or {}):
                drug_ids.add(str(cid))
            for cid in (feat.get("procedure_concepts") or {}):
                procedure_ids.add(str(cid))
            lab_vec = feat.get("lab_vector") or {}
            if isinstance(lab_vec, dict):
                for lid in lab_vec:
                    lab_ids.add(str(lid))

        sorted_conditions = sorted(condition_ids)
        sorted_drugs = sorted(drug_ids)
        sorted_procedures = sorted(procedure_ids)
        sorted_labs = sorted(lab_ids)

        # Feature names: demographics + binary concept presence + continuous labs
        feature_names: list[str] = [
            "demographics_age_norm",
            "demographics_gender_8507",
            "demographics_gender_8532",
        ]
        feature_names.extend(f"condition_{c}" for c in sorted_conditions)
        feature_names.extend(f"drug_{d}" for d in sorted_drugs)
        feature_names.extend(f"procedure_{p}" for p in sorted_procedures)
        feature_names.extend(f"lab_{l}" for l in sorted_labs)

        n_patients = len(all_features)
        n_features = len(feature_names)
        matrix = np.zeros((n_patients, n_features), dtype=np.float64)

        cond_offset = 3
        drug_offset = cond_offset + len(sorted_conditions)
        proc_offset = drug_offset + len(sorted_drugs)
        lab_offset = proc_offset + len(sorted_procedures)

        cond_idx = {c: i for i, c in enumerate(sorted_conditions)}
        drug_idx = {d: i for i, d in enumerate(sorted_drugs)}
        proc_idx = {p: i for i, p in enumerate(sorted_procedures)}
        lab_idx = {l: i for i, l in enumerate(sorted_labs)}

        for row, feat in enumerate(all_features):
            # Age bucket normalized to [0, 1] (buckets typically 0-17)
            age = feat.get("age_bucket", 0) or 0
            matrix[row, 0] = age / 17.0 if age > 0 else 0.0

            # Gender one-hot
            gender = feat.get("gender_concept_id", 0) or 0
            if gender == 8507:
                matrix[row, 1] = 1.0
            elif gender == 8532:
                matrix[row, 2] = 1.0

            # Binary concept presence
            for cid in (feat.get("condition_concepts") or {}):
                idx = cond_idx.get(str(cid))
                if idx is not None:
                    matrix[row, cond_offset + idx] = 1.0

            for cid in (feat.get("drug_concepts") or {}):
                idx = drug_idx.get(str(cid))
                if idx is not None:
                    matrix[row, drug_offset + idx] = 1.0

            for cid in (feat.get("procedure_concepts") or {}):
                idx = proc_idx.get(str(cid))
                if idx is not None:
                    matrix[row, proc_offset + idx] = 1.0

            # Lab z-scores (continuous)
            lab_vec = feat.get("lab_vector") or {}
            if isinstance(lab_vec, dict):
                for lid, zscore in lab_vec.items():
                    idx = lab_idx.get(str(lid))
                    if idx is not None:
                        try:
                            matrix[row, lab_offset + idx] = float(zscore)
                        except (ValueError, TypeError):
                            pass

        return matrix, labels, feature_names

    @staticmethod
    def fit_propensity_model(
        feature_matrix: NDArray[np.float64],
        labels: NDArray[np.int64],
    ) -> tuple[NDArray[np.float64], float]:
        """Fit L1-regularized logistic regression and return (ps_scores, auc).

        ps_scores is P(target | X) for every patient in feature_matrix.
        """
        # Remove zero-variance columns to avoid convergence warnings
        col_var = feature_matrix.var(axis=0)
        active_cols = col_var > 0
        X = feature_matrix[:, active_cols]

        if X.shape[1] == 0:
            # All features are constant — return uniform PS
            n = len(labels)
            prevalence = float(labels.sum()) / n
            return np.full(n, prevalence), 0.5

        model = LogisticRegression(
            solver="saga",
            max_iter=1000,
            C=1.0,
            l1_ratio=1.0,
            random_state=42,
        )
        model.fit(X, labels)
        ps = model.predict_proba(X)[:, 1]

        # Compute AUC
        try:
            auc = float(roc_auc_score(labels, ps))
        except ValueError:
            auc = 0.5

        return ps.astype(np.float64), auc

    @staticmethod
    def compute_preference_scores(
        ps: NDArray[np.float64],
        prevalence: float,
    ) -> NDArray[np.float64]:
        """Convert propensity scores to preference scores.

        pref = ps * (1 - prev) / (ps * (1 - prev) + (1 - ps) * prev)
        """
        prev = np.clip(prevalence, 0.001, 0.999)
        ps_clipped = np.clip(ps, 0.001, 0.999)
        numerator = ps_clipped * (1.0 - prev)
        denominator = numerator + (1.0 - ps_clipped) * prev
        return np.asarray((numerator / denominator), dtype=np.float64)

    @staticmethod
    def match_patients(
        target_indices: NDArray[np.int64],
        target_ps: NDArray[np.float64],
        comparator_indices: NDArray[np.int64],
        comparator_ps: NDArray[np.float64],
        caliper_scale: float = 0.2,
        max_ratio: int = 4,
    ) -> tuple[list[dict[str, Any]], list[int], list[int]]:
        """Greedy nearest-neighbor matching on logit(PS) within caliper.

        Returns (matched_pairs, unmatched_target_indices, unmatched_comparator_indices).
        """
        # Clip PS and compute logit
        eps = 0.001
        t_ps = np.clip(target_ps, eps, 1.0 - eps)
        c_ps = np.clip(comparator_ps, eps, 1.0 - eps)
        t_logit = np.log(t_ps / (1.0 - t_ps))
        c_logit = np.log(c_ps / (1.0 - c_ps))

        # Caliper = caliper_scale * std(logit(all PS))
        all_logit = np.concatenate([t_logit, c_logit])
        logit_std = float(np.std(all_logit))
        caliper = caliper_scale * logit_std if logit_std > 0 else 0.2

        # Sort targets by PS for greedy matching
        order = np.argsort(t_logit)
        matched_pairs: list[dict[str, Any]] = []
        used_comparators: set[int] = set()
        unmatched_target: list[int] = []

        for idx in order:
            t_val = t_logit[idx]
            distances = np.abs(c_logit - t_val)

            # Find up to max_ratio nearest unused comparators within caliper
            sorted_comp = np.argsort(distances)
            matches_found = 0
            for comp_idx in sorted_comp:
                if matches_found >= max_ratio:
                    break
                if int(comp_idx) in used_comparators:
                    continue
                if distances[comp_idx] <= caliper:
                    matched_pairs.append({
                        "target_id": int(target_indices[idx]),
                        "comparator_id": int(comparator_indices[comp_idx]),
                        "distance": float(distances[comp_idx]),
                    })
                    used_comparators.add(int(comp_idx))
                    matches_found += 1

            if matches_found == 0:
                unmatched_target.append(int(target_indices[idx]))

        unmatched_comparator = [
            int(comparator_indices[i])
            for i in range(len(comparator_indices))
            if i not in used_comparators
        ]

        return matched_pairs, unmatched_target, unmatched_comparator

    @staticmethod
    def compute_balance(
        feature_matrix: NDArray[np.float64],
        labels: NDArray[np.int64],
        matched_target_rows: NDArray[np.int64],
        matched_comparator_rows: NDArray[np.int64],
        feature_names: list[str],
    ) -> dict[str, list[dict[str, Any]]]:
        """Compute before/after SMD balance for all covariates.

        Returns {before: [...], after: [...]} where each entry has
        covariate, smd, type, domain.
        """
        target_mask = labels == 1
        comp_mask = labels == 0

        def compute_smd_list(
            t_matrix: NDArray[np.float64],
            c_matrix: NDArray[np.float64],
        ) -> list[dict[str, Any]]:
            results: list[dict[str, Any]] = []
            for col_idx, name in enumerate(feature_names):
                t_vals = t_matrix[:, col_idx]
                c_vals = c_matrix[:, col_idx]

                t_mean = float(np.mean(t_vals))
                c_mean = float(np.mean(c_vals))
                t_var = float(np.var(t_vals, ddof=1)) if len(t_vals) > 1 else 0.0
                c_var = float(np.var(c_vals, ddof=1)) if len(c_vals) > 1 else 0.0
                pooled_sd = np.sqrt((t_var + c_var) / 2.0)

                smd = (t_mean - c_mean) / pooled_sd if pooled_sd > 0 else 0.0

                # Classify domain from feature name prefix
                if name.startswith("condition_"):
                    domain = "conditions"
                elif name.startswith("drug_"):
                    domain = "drugs"
                elif name.startswith("procedure_"):
                    domain = "procedures"
                elif name.startswith("lab_"):
                    domain = "labs"
                else:
                    domain = "demographics"

                # Classify type: binary for concept presence, continuous for age/lab
                cov_type = "continuous" if domain in ("demographics", "labs") else "binary"
                if name.startswith("demographics_gender"):
                    cov_type = "binary"

                results.append({
                    "covariate": name,
                    "smd": round(smd, 6),
                    "type": cov_type,
                    "domain": domain,
                })
            return results

        before = compute_smd_list(
            feature_matrix[target_mask],
            feature_matrix[comp_mask],
        )

        # After matching
        if len(matched_target_rows) > 0 and len(matched_comparator_rows) > 0:
            after = compute_smd_list(
                feature_matrix[matched_target_rows],
                feature_matrix[matched_comparator_rows],
            )
        else:
            after = [{**row, "smd": row["smd"]} for row in before]

        return {"before": before, "after": after}

    @staticmethod
    def compute_preference_distribution(
        target_pref: NDArray[np.float64],
        comparator_pref: NDArray[np.float64],
        n_bins: int = 50,
    ) -> dict[str, list[float]]:
        """Compute binned density histogram of preference scores."""
        bin_edges = np.linspace(0.0, 1.0, n_bins + 1)
        bin_centers = ((bin_edges[:-1] + bin_edges[1:]) / 2.0).tolist()

        t_counts, _ = np.histogram(target_pref, bins=bin_edges)
        c_counts, _ = np.histogram(comparator_pref, bins=bin_edges)

        # Normalize to density (proportion of group)
        t_total = max(len(target_pref), 1)
        c_total = max(len(comparator_pref), 1)

        return {
            "bins": [round(b, 4) for b in bin_centers],
            "target_density": [round(float(c) / t_total, 6) for c in t_counts],
            "comparator_density": [round(float(c) / c_total, 6) for c in c_counts],
        }
