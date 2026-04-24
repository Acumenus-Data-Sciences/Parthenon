from __future__ import annotations


class StepError(Exception):
    """Raised by a Step.run() implementation to signal a recoverable failure."""
