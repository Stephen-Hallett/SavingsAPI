import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import datetime

import pytz
from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import APIRouter

from ..API.kernel_wealth import Controller
from ..utils.db import SavingsDB, SavingsRow
from ..utils.logger import MyLogger

logger = MyLogger().get_logger()

con = Controller()

db_con = SavingsDB()
tz = pytz.timezone("Pacific/Auckland")


def save_data() -> None:
    save = SavingsRow(
        time=datetime.now(tz=pytz.timezone("UTC")),
        platform="Kernel Wealth",
        account="Save",
        amount=con.get_save_value(),
    )
    portfolio = SavingsRow(
        time=datetime.now(tz=pytz.timezone("UTC")),
        platform="Kernel Wealth",
        account="Portfolio",
        amount=con.get_portfolio_value(),
    )
    db_con.insert(save)
    db_con.insert(portfolio)


@asynccontextmanager
async def lifespan(_: APIRouter) -> AsyncGenerator[None, None]:
    scheduler = BackgroundScheduler()
    minute, hour, day, month, wday = os.environ["SAVE_TIME"].split(" ")
    scheduler.add_job(
        save_data,
        "cron",
        minute=minute,
        hour=hour,
        day=day,
        month=month,
        day_of_week=wday,
    )
    scheduler.start()
    yield


router = APIRouter(lifespan=lifespan)


@router.get("/value")
async def value() -> float:
    return con.get_account_value()
