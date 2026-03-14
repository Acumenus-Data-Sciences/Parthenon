"""Spatial statistics service using PySAL (lazy-loaded).

All PySAL imports are deferred to first use to avoid startup penalty.
"""

from __future__ import annotations

import time
from typing import Any

import numpy as np


def _lazy_import_pysal() -> tuple[Any, Any, Any, Any]:
    """Import PySAL modules on first call."""
    import libpysal
    from esda.moran import Moran
    from esda.getisord import G_Local
    from spreg import OLS

    return libpysal, Moran, G_Local, OLS


def compute_morans_i(
    values: list[float],
    coordinates: list[tuple[float, float]],
    k: int = 8,
) -> dict[str, Any]:
    """Compute Moran's I statistic for spatial autocorrelation."""
    start = time.time()
    libpysal, Moran, _, _ = _lazy_import_pysal()

    coords = np.array(coordinates)
    y = np.array(values)

    # K-nearest neighbors spatial weights
    w = libpysal.weights.KNN.from_array(coords, k=k)
    w.transform = "r"

    mi = Moran(y, w)

    return {
        "morans_i": float(mi.I),
        "expected_i": float(mi.EI),
        "p_value": float(mi.p_sim),
        "z_score": float(mi.z_sim),
        "significant": mi.p_sim < 0.05,
        "interpretation": (
            "positive spatial autocorrelation (clustering)"
            if mi.I > mi.EI and mi.p_sim < 0.05
            else "negative spatial autocorrelation (dispersion)"
            if mi.I < mi.EI and mi.p_sim < 0.05
            else "no significant spatial pattern"
        ),
        "computation_time_ms": int((time.time() - start) * 1000),
    }


def compute_hotspots(
    values: list[float],
    coordinates: list[tuple[float, float]],
    fips_codes: list[str],
    k: int = 8,
    alpha: float = 0.05,
) -> dict[str, Any]:
    """Compute Getis-Ord Gi* hotspot analysis."""
    start = time.time()
    libpysal, _, G_Local, _ = _lazy_import_pysal()

    coords = np.array(coordinates)
    y = np.array(values)

    w = libpysal.weights.KNN.from_array(coords, k=k)
    w.transform = "b"

    g = G_Local(y, w, star=True)

    hotspots = []
    for i, (z, p, fips) in enumerate(zip(g.Zs, g.p_sim, fips_codes)):
        if p < alpha:
            hotspots.append({
                "fips": fips,
                "z_score": float(z),
                "p_value": float(p),
                "type": "hot" if z > 0 else "cold",
            })

    return {
        "hotspots": hotspots,
        "total_hot": sum(1 for h in hotspots if h["type"] == "hot"),
        "total_cold": sum(1 for h in hotspots if h["type"] == "cold"),
        "total_regions": len(values),
        "alpha": alpha,
        "computation_time_ms": int((time.time() - start) * 1000),
    }


def compute_correlation(
    x_values: list[float],
    y_values: list[float],
    x_label: str = "x",
    y_label: str = "y",
) -> dict[str, Any]:
    """Compute Pearson correlation between two variables."""
    start = time.time()
    from scipy import stats

    x = np.array(x_values)
    y = np.array(y_values)

    r, p = stats.pearsonr(x, y)

    return {
        "r": float(r),
        "r_squared": float(r**2),
        "p_value": float(p),
        "significant": p < 0.05,
        "n": len(x),
        "x_label": x_label,
        "y_label": y_label,
        "computation_time_ms": int((time.time() - start) * 1000),
    }


def compute_regression(
    y_values: list[float],
    x_matrix: list[list[float]],
    x_labels: list[str],
    coordinates: list[tuple[float, float]],
) -> dict[str, Any]:
    """OLS regression with spatial diagnostics."""
    start = time.time()
    libpysal, _, _, OLS = _lazy_import_pysal()

    coords = np.array(coordinates)
    y = np.array(y_values).reshape(-1, 1)
    x = np.array(x_matrix)

    w = libpysal.weights.KNN.from_array(coords, k=8)
    w.transform = "r"

    model = OLS(y, x, w=w, name_y="outcome_rate", name_x=x_labels)

    coefficients = []
    for i, label in enumerate(x_labels):
        coefficients.append({
            "variable": label,
            "coefficient": float(model.betas[i + 1][0]),
            "std_error": float(model.std_err[i + 1]),
            "t_stat": float(model.t_stat[i + 1][0]),
            "p_value": float(model.t_stat[i + 1][1]),
        })

    return {
        "r_squared": float(model.r2),
        "adj_r_squared": float(model.ar2),
        "f_stat": float(model.f_stat[0]),
        "f_p_value": float(model.f_stat[1]),
        "coefficients": coefficients,
        "n": len(y_values),
        "computation_time_ms": int((time.time() - start) * 1000),
    }
