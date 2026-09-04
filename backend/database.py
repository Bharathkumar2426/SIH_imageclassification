"""Database Session and Engine Setup using SQLAlchemy Async (SIH 26057)."""

from typing import AsyncGenerator
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from backend.config import settings

DATABASE_URL = f"sqlite+aiosqlite:///{settings.DB_PATH}"

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)

async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def init_db() -> None:
    """Initializes all database tables on application startup and migrates columns if needed."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Check and migrate columns in detections table if needed
        try:
            res = await conn.execute(text("PRAGMA table_info(detections)"))
            cols = [row[1] for row in res.fetchall()]
            if cols and "anomaly_score" not in cols:
                await conn.execute(text("ALTER TABLE detections ADD COLUMN anomaly_score FLOAT DEFAULT 0.0"))
            if cols and "classification_source" not in cols:
                await conn.execute(text("ALTER TABLE detections ADD COLUMN classification_source VARCHAR(32) DEFAULT 'detector'"))
        except Exception:
            pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency that yields an asynchronous database session."""
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()
