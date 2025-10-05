from fastapi import APIRouter

from ..API.ASB import Controller
from ..utils.logger import MyLogger

router = APIRouter()
logger = MyLogger().get_logger()

con = Controller()


@router.get("/value")
async def value() -> float:
    return con.get_account_value()
