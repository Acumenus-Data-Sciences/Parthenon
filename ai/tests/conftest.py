import os

os.environ.setdefault("DATABASE_URL", "postgresql://parthenon:parthenon@localhost:5480/parthenon")

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
