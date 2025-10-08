from datetime import datetime

import pytz
from fastapi import APIRouter, Query

from ..API.investnow import Controller
from ..utils.db import SavingsDB, SavingsRow
from ..utils.logger import MyLogger

router = APIRouter()
logger = MyLogger().get_logger()

con = Controller()


db_con = SavingsDB()
tz = pytz.timezone("Pacific/Auckland")


@router.post("/save")
async def save_data(token: str) -> None:
    portfolio = SavingsRow(
        time=datetime.now(tz=tz),
        platform="InvestNow",
        account="Portfolio",
        amount=con.get_portfolio_value(token),
    )
    db_con.insert(portfolio)


@router.post("/token")
async def get_token(passcode: int | None = Query(None)) -> str:
    return con.get_token(passcode)


@router.get("/value")
async def value(token: str) -> float:
    return con.get_account_value(token)
