import datetime
import os
from typing import Any

import polars as pl
import psycopg2
import pytz
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

    def current_portfolio(self) -> dict[str, (None, dict)]:
        # Pacific/Auckland timezone
        now_nz = datetime.datetime.now(tz=pytz.timezone("Pacific/Auckland"))

        with (
            self.get_connection() as conn,
            conn.cursor(cursor_factory=RealDictCursor) as cur,
        ):
            # Get latest for each account/platform for today and yesterday (NZ time)
            cur.execute(
                """
WITH latest_per_day AS (
    SELECT
        *,
        ROW_NUMBER() OVER (
            PARTITION BY account, platform, timezone('Pacific/Auckland', time)::date
            ORDER BY time DESC
        ) AS rn,
        timezone('Pacific/Auckland', time)::date AS nz_date
    FROM savings
),
daily_totals AS (
    SELECT
        platform,
        account,
        amount,
        nz_date,
        %s::date - nz_date AS days_ago
    FROM latest_per_day
    WHERE rn = 1
)

SELECT *
FROM daily_totals
        """,
                (now_nz,),
            )
            result = cur.fetchall()
            data = pl.from_dicts(result)

            def past_data(data: pl.DataFrame, days_ago: int) -> pl.DataFrame:
                return (
                    data.filter(pl.col.days_ago >= days_ago)
                    .group_by(["platform", "account"])
                    .agg(pl.col.days_ago.min())
                    .join(data, on=["platform", "account", "days_ago"])
                    .group_by("platform")
                    .agg(pl.col.amount.sum().round(2))
                    .sort(by="platform", descending=False)
                )

            today = past_data(data, 0)
            yesterday = past_data(data, 1)
            last_week = past_data(data, 7)
            last_month = past_data(data, 30)
            last_year = past_data(data, 365)

            today_total = round(today["amount"].sum())
            yesterday_total = round(yesterday["amount"].sum())

            today_weights = today.with_columns((pl.col.amount / today_total).round(2))
            yesterday_weights = yesterday.with_columns(
                (pl.col.amount / yesterday_total).round(2)
            )

            return {
                "holdings": {
                    "today": dict(today.rows()),
                    "yesterday": dict(yesterday.rows()),
                },
                "weightings": {
                    "today": dict(today_weights.rows()),
                    "yesterday": dict(yesterday_weights.rows()),
                },
                "total": today_total,
                "yesterday_total": yesterday_total,
                "pct_change": round(100 * today_total / yesterday_total - 100, 1)
                if yesterday.shape[0] > 0
                else None,
                "week_over_week": round(
                    100 * today_total / last_week["amount"].sum() - 100, 1
                )
                if last_week.shape[0] > 0
                else None,
                "month_over_month": round(
                    100 * today_total / last_month["amount"].sum() - 100, 1
                )
                if last_month.shape[0] > 0
                else None,
                "year_over_year": round(
                    100 * today_total / last_year["amount"].sum() - 100, 1
                )
                if last_year.shape[0] > 0
                else None,
            }
