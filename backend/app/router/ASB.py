import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import datetime

import pytz
from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import APIRouter

from ..API.ASB import Controller
from ..utils.db import SavingsDB, SavingsRow
from ..utils.logger import MyLogger

logger = MyLogger().get_logger()

con = Controller()

db_con = SavingsDB()
tz = pytz.timezone("Pacific/Auckland")


def save_data() -> None:
    td_6 = SavingsRow(
        time=datetime.now(tz=tz),
        platform="ASB",
        account="6 month term deposit",
        amount=con.get_6_month_value(),
    )
    td_12 = SavingsRow(
        time=datetime.now(tz=tz),
        platform="ASB",
        account="12 month term deposit",
        amount=con.get_12_month_value(),
    )
    db_con.insert(td_6)
    db_con.insert(td_12)


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


@router.get("/test")
async def save_data_test() -> None:
    td_6 = {
        "time": datetime.now(tz=tz),
        "platform": "ASB",
        "account": "6 month term deposit",
        "amount": con.get_6_month_value(),
    }
    td_12 = {
        "time": datetime.now(tz=tz),
        "platform": "ASB",
        "account": "12 month term deposit",
        "amount": con.get_12_month_value(),
    }
    db_con.insert(td_6)
    db_con.insert(td_12)
