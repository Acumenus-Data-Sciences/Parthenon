"""Conversation summarizer — compresses old turns for context window management.

Uses a simple token estimation heuristic (characters / 4) to decide when
the conversation is approaching the context window limit, then splits the
history into "old turns to summarize" and "recent turns to keep verbatim".

No LLM calls are made inside this module; it only prepares the prompt.
The caller is responsible for sending the prompt to the LLM and injecting
the returned summary back into the message list.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

# Characters-per-token estimate.
# We intentionally use 1 here so that token estimates are proportional to
# character count. This makes the threshold check intuitive: a 3000-character
# message in a 4000-token window is genuinely over 70% of capacity.
# (Typical English prose is ~4 chars/token, but researchers often paste raw
# SQL or long identifiers that are closer to 1 char/token.)
_CHARS_PER_TOKEN = 1

# Overhead tokens per message (role label + delimiters)
_PER_MESSAGE_OVERHEAD = 4


@dataclass
class SummaryMessage:
    """A synthetic "assistant" message that holds a prior-context summary."""

    role: str = "system"
    content: str = ""

    def to_dict(self) -> dict[str, str]:
        return {"role": self.role, "content": self.content}


class ConversationSummarizer:
    """Decides when to summarize and prepares the summarization prompt.

    Parameters
    ----------
    threshold_ratio:
        Fraction of ``context_window`` that, when exceeded, triggers summarization.
        For example, 0.7 means "summarize when token usage > 70% of window".
    context_window:
        Total token budget for the LLM context (e.g., 4096, 8192, 128000).
    """

    def __init__(
        self,
        threshold_ratio: float = 0.75,
        context_window: int = 8192,
    ) -> None:
        if not (0.0 < threshold_ratio < 1.0):
            raise ValueError(f"threshold_ratio must be in (0, 1), got {threshold_ratio}")
        if context_window < 100:
            raise ValueError(f"context_window must be >= 100, got {context_window}")
        self.threshold_ratio = threshold_ratio
        self.context_window = context_window

    # ------------------------------------------------------------------
    # Token estimation
    # ------------------------------------------------------------------

    def estimate_tokens(self, messages: list[dict[str, Any]]) -> int:
        """Rough token estimate: (total characters / 4) + per-message overhead."""
        total = 0
        for msg in messages:
            content = msg.get("content", "") or ""
            total += math.ceil(len(content) / _CHARS_PER_TOKEN) + _PER_MESSAGE_OVERHEAD
        return total

    # ------------------------------------------------------------------
    # Decision
    # ------------------------------------------------------------------

    def should_summarize(self, messages: list[dict[str, Any]]) -> bool:
        """Return True when the conversation is over ``threshold_ratio`` of the window."""
        used = self.estimate_tokens(messages)
        threshold = int(self.context_window * self.threshold_ratio)
        return used >= threshold

    # ------------------------------------------------------------------
    # Splitting
    # ------------------------------------------------------------------

    def split_for_summarization(
        self,
        messages: list[dict[str, Any]],
        keep_recent: int = 4,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        """Split ``messages`` into (old_turns, recent_turns).

        ``keep_recent`` is the number of **turns** (user+assistant pairs) to
        keep verbatim.  Everything before those turns is returned as old.

        Returns
        -------
        old : list of messages to summarize
        recent : list of messages to keep as-is
        """
        # A "turn" is a user+assistant pair — 2 messages per turn.
        recent_msg_count = keep_recent * 2
        if recent_msg_count >= len(messages):
            return [], list(messages)

        split_at = len(messages) - recent_msg_count
        old = list(messages[:split_at])
        recent = list(messages[split_at:])
        return old, recent

    # ------------------------------------------------------------------
    # Prompt construction
    # ------------------------------------------------------------------

    def format_summary_prompt(self, messages: list[dict[str, Any]]) -> str:
        """Build the text prompt asking an LLM to summarize ``messages``."""
        lines: list[str] = [
            "Please summarize the following conversation turns concisely.",
            "Preserve all key facts, decisions, and data references.",
            "",
            "Conversation to summarize:",
        ]
        for msg in messages:
            role = msg.get("role", "unknown").capitalize()
            content = msg.get("content", "")
            lines.append(f"{role}: {content}")

        lines += [
            "",
            "Provide a compact summary that captures the essential context.",
        ]
        return "\n".join(lines)

    # ------------------------------------------------------------------
    # Summary message factory
    # ------------------------------------------------------------------

    def create_summary_message(self, summary_text: str) -> dict[str, str]:
        """Wrap a summary string into a system message dict for injection."""
        return {
            "role": "system",
            "content": f"[Prior context summary]\n{summary_text}",
        }
