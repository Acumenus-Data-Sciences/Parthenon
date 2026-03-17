"""Intent stack for working memory — tracks active topics across conversation turns."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class IntentEntry:
    topic: str
    first_turn: int
    last_active_turn: int


class IntentStack:
    """Bounded stack of active conversation topics with expiry."""

    def __init__(self, max_depth: int = 3, expiry_turns: int = 10) -> None:
        self.max_depth = max_depth
        self.expiry_turns = expiry_turns
        self.entries: list[IntentEntry] = []

    def push(self, topic: str, turn: int) -> None:
        for entry in self.entries:
            if entry.topic == topic:
                entry.last_active_turn = turn
                return
        if len(self.entries) >= self.max_depth:
            self.entries.pop(0)
        self.entries.append(IntentEntry(topic=topic, first_turn=turn, last_active_turn=turn))

    def refresh(self, topic: str, turn: int) -> bool:
        for entry in self.entries:
            if entry.topic == topic:
                entry.last_active_turn = turn
                return True
        return False

    def clear_and_set(self, topic: str, turn: int) -> None:
        self.entries.clear()
        self.push(topic, turn)

    def prune(self, current_turn: int) -> None:
        self.entries = [e for e in self.entries if (current_turn - e.last_active_turn) <= self.expiry_turns]

    def current_topic(self) -> str | None:
        if not self.entries:
            return None
        return self.entries[-1].topic

    def get_context_string(self) -> str:
        if not self.entries:
            return ""
        topics = [e.topic for e in self.entries]
        return "Active conversation topics: " + ", ".join(topics)

    def __len__(self) -> int:
        return len(self.entries)

    def to_dict(self) -> dict[str, Any]:
        return {
            "max_depth": self.max_depth,
            "expiry_turns": self.expiry_turns,
            "entries": [{"topic": e.topic, "first_turn": e.first_turn, "last_active_turn": e.last_active_turn} for e in self.entries],
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> IntentStack:
        stack = cls(max_depth=data["max_depth"], expiry_turns=data["expiry_turns"])
        stack.entries = [IntentEntry(topic=e["topic"], first_turn=e["first_turn"], last_active_turn=e["last_active_turn"]) for e in data["entries"]]
        return stack
