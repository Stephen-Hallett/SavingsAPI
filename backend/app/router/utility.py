import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import pytz
from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import APIRouter

from ..API.simplicity import Controller
from ..utils.db import SavingsDB
from ..utils.logger import MyLogger

logger = MyLogger().get_logger()

con = Controller()

db_con = SavingsDB()
tz = pytz.timezone("Pacific/Auckland")


@asynccontextmanager
async def lifespan(_: APIRouter) -> AsyncGenerator[None, None]:
    scheduler = BackgroundScheduler()
    minute, hour, day, month, wday = os.environ["SAVE_TIME"].split(" ")
    scheduler.add_job(
        db_con.identify_expired,
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


@router.get("/expired")
async def expired() -> None:
    print("Accounting for expired investments")
    return db_con.identify_expired()
