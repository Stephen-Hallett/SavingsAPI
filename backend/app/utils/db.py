import datetime
import os
from typing import Any

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

    def current_portfolio(self) -> dict[str, dict | float]:
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
),
today AS (
    SELECT platform, account, amount
    FROM daily_totals
    WHERE days_ago = 0
),
yesterday AS (
    SELECT platform, account, amount
    FROM daily_totals
    WHERE days_ago = 1
),
one_month_ago AS (
    SELECT DISTINCT ON (platform, account)
        platform, account, amount
    FROM daily_totals
    WHERE days_ago >= 30
    ORDER BY platform, account, days_ago ASC
),
one_month_ago_fallback AS (
    SELECT DISTINCT ON (platform, account)
        platform, account, amount
    FROM daily_totals
    WHERE days_ago < 30
    ORDER BY platform, account, days_ago DESC
),
one_year_ago AS (
    SELECT DISTINCT ON (platform, account)
        platform, account, amount
    FROM daily_totals
    WHERE days_ago >= 365
    ORDER BY platform, account, days_ago ASC
),
one_year_ago_fallback AS (
    SELECT DISTINCT ON (platform, account)
        platform, account, amount
    FROM daily_totals
    WHERE days_ago < 365
    ORDER BY platform, account, days_ago DESC
)
SELECT
    COALESCE(t.platform, y.platform, m.platform, mf.platform, yr.platform, yf.platform) AS platform,
    COALESCE(SUM(t.amount), 0) AS today,
    COALESCE(SUM(y.amount), 0) AS yesterday,
    COALESCE(SUM(m.amount), SUM(mf.amount), 0) AS one_month_ago,
    COALESCE(SUM(yr.amount), SUM(yf.amount), 0) AS one_year_ago
FROM today t
FULL OUTER JOIN yesterday y
    ON t.platform = y.platform AND t.account = y.account
FULL OUTER JOIN one_month_ago m
    ON COALESCE(t.platform, y.platform) = m.platform
    AND COALESCE(t.account, y.account) = m.account
FULL OUTER JOIN one_month_ago_fallback mf
    ON COALESCE(t.platform, y.platform) = mf.platform
    AND COALESCE(t.account, y.account) = mf.account
    AND m.platform IS NULL
FULL OUTER JOIN one_year_ago yr
    ON COALESCE(t.platform, y.platform, m.platform, mf.platform) = yr.platform
    AND COALESCE(t.account, y.account, m.account, mf.account) = yr.account
FULL OUTER JOIN one_year_ago_fallback yf
    ON COALESCE(t.platform, y.platform, m.platform, mf.platform) = yf.platform
    AND COALESCE(t.account, y.account, m.account, mf.account) = yf.account
    AND yr.platform IS NULL
GROUP BY COALESCE(
    t.platform,
    y.platform,
    m.platform,
    mf.platform,
    yr.platform,
    yf.platform
)
        """,
                (now_nz,),
            )
            result = cur.fetchall()

            holdings = {row["platform"]: round(row["today"], 2) for row in result}
            yesterday_holdings = {
                row["platform"]: round(row["yesterday"], 2) for row in result
            }
            total = round(sum(holdings.values()), 2)
            yesterday_total = round(sum(row["yesterday"] for row in result), 2)
            last_month_total = round(sum(row["one_month_ago"] for row in result), 2)
            last_year_total = round(sum(row["one_year_ago"] for row in result), 2)

            weights = {
                key: round(100 * (value / total), 1) if total else 0.0
                for key, value in holdings.items()
            }
            yesterday_weights = {
                key: round(100 * (value / yesterday_total), 1)
                if yesterday_total
                else 0.0
                for key, value in yesterday_holdings.items()
            }

            return {
                "holdings": {"today": holdings, "yesterday": yesterday_holdings},
                "weightings": {"today": weights, "yesterday": yesterday_weights},
                "total": total,
                "yesterday_total": yesterday_total
                if yesterday_total is not None
                else None,
                "pct_change": round(100 * total / yesterday_total - 100, 1)
                if yesterday_total is not None
                else None,
                "month_over_month": round(100 * total / last_month_total - 100, 1)
                if last_month_total is not None
                else None,
                "year_over_year": round(100 * total / last_year_total - 100, 1)
                if last_year_total is not None
                else None,
            }
