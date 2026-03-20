import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

TEST_DB_URL = "postgresql://parthenon:secret@localhost:5480/parthenon"


@pytest.fixture(scope="session")
def db_engine():
    return create_engine(TEST_DB_URL)


@pytest.fixture
def db_session(db_engine):
    """Each test runs in a transaction that rolls back — no pollution."""
    connection = db_engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)
    yield session
    session.close()
    transaction.rollback()
    connection.close()
