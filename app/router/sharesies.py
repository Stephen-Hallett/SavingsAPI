from typing import Annotated

from fastapi import APIRouter, Header

from ..API.sharesies import Controller
from ..utils.logger import MyLogger

router = APIRouter()
logger = MyLogger().get_logger()

con = Controller()


@router.get("/list")
async def accounts(username: Annotated[str, Header()]) -> list[dict]:
    print(username)
    return con.list_accounts()
