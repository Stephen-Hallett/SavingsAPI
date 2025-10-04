from fastapi import APIRouter, Query

from ..API.investnow import Controller
from ..utils.logger import MyLogger

router = APIRouter()
logger = MyLogger().get_logger()

con = Controller()


@router.post("/token")
async def get_token(passcode: int | None = Query(None)) -> str:
    return con.get_token(passcode)


@router.get("/value")
async def value(token: str) -> float:
    return con.get_account_value(token)
