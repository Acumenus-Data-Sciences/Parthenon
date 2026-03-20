from abc import ABC, abstractmethod

from sqlalchemy.orm import Session


class SourceAdapter(ABC):
    """Base class for all EHR source adapters."""

    def __init__(self, session: Session):
        self.session = session

    @abstractmethod
    def create_batch(self, source_name: str) -> int:
        """Create a load_batch record and return batch_id."""

    @abstractmethod
    def stage_all(self) -> int:
        """Stage all available data. Returns batch_id."""
