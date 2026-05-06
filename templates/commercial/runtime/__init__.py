# Phase 3 Plan 1 (T-021A): namespace marker for the commercial wheel.
#
# The commercial wheel layers ``runtime.commercial.*`` on top of the
# ``runtime.*`` namespace shipped by the community wheel. We rely on
# Python's regular package mechanic (with an __init__.py) since hatchling
# packs the explicit ``runtime/commercial`` package — but consumers of
# both wheels resolve sibling subpackages through the standard import
# system without us needing implicit-namespace gymnastics.
#
# This file is intentionally empty so that the community wheel's
# ``runtime/__init__.py`` (NOT this one) wins when both are installed —
# Python's import system resolves the first ``runtime`` package on
# sys.path, and hatchling never includes this file in the commercial
# wheel because the wheel's package root is ``runtime/commercial``.
