from fastapi import APIRouter
from fastapi_utilities import repeat_at

from ..API.ASB import Controller
from ..utils.logger import MyLogger

router = APIRouter()
logger = MyLogger().get_logger()

con = Controller()


@router.get("/value")
async def value() -> float:
    return con.get_account_value()


@router.on_startup()
@repeat_at(cron="0 0 * * *")  # Every day at midnight
async def save_data() -> None:
    td_6 = con.get_6_month_value()
    td_12 = con.get_12_month_value()
