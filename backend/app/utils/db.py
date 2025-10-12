import datetime
import os
from typing import Any

import psycopg2
from psycopg2.extras import RealDictCursor
from pydantic import BaseModel


class SavingsRow(BaseModel):
    time: datetime.datetime
    platform: str
    account: str
    amount: float


class SavingsDB:
    def __init__(
        self,
        host: str = os.environ["POSTGRES_HOST"],
        port: int = os.environ["POSTGRES_PORT"],
        database: str = os.environ["POSTGRES_DB"],
        user: str = os.environ["POSTGRES_USER"],
        password: str = os.environ["POSTGRES_PW"],
    ) -> None:
        self.connection_params: dict[str, str] = {
            "host": host,
            "port": port,
            "database": database,
            "user": user,
            "password": password,
        }

    def get_connection(self) -> Any:  # NOQA
        """Get database connection."""
        return psycopg2.connect(**self.connection_params)  # pyright: ignore

    def insert(self, item: SavingsRow) -> None:
        with (
            self.get_connection() as conn,
            conn.cursor(cursor_factory=RealDictCursor) as cur,
        ):
            cur.execute(
                """
                    INSERT INTO savings (time, platform, account, amount)
                    VALUES (%s, %s, %s, %s)
                """,
                (item.time, item.platform, item.account, item.amount),
            )
            conn.commit()

    def current_portfolio(self) -> dict[str, dict | float]:
        with (
            self.get_connection() as conn,
            conn.cursor(cursor_factory=RealDictCursor) as cur,
        ):
            cur.execute("""
                        SELECT platform, sum(amount) AS total
                        FROM
                        (SELECT *
                            FROM (
                            SELECT *,
                                    ROW_NUMBER() OVER (
                                    PARTITION BY account, platform
                                    ORDER BY time DESC
                                    ) AS rn
                            FROM savings
                            ) sub
                            WHERE rn = 1)
                        GROUP BY platform
                    """)
            result = cur.fetchall()
            holdings = {row["platform"]: round(row["total"], 2) for row in result}
            return {"holdings": holdings, "total": round(sum(holdings.values()), 2)}
