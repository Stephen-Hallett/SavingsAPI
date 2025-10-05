import os
from typing import Any

import psycopg2
from psycopg2.extras import RealDictCursor


class BaseDB:
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

    def insert(self) -> None:
        with (
            self.get_connection() as conn,
            conn.cursor(cursor_factory=RealDictCursor) as cur,
        ):
            cur.execute(
                """
                    INSERT INTO savings (time, platform, account, amount)
                    VALUES (%s, %s, %s, %s)
                """
            )
            print([dict(row) for row in cur.fetchall()])
