import logging
import os

import pytz
import requests

from ..utils.handle_missing import handle_missing
from ..utils.logger import MyLogger, log


class Controller:
    def __init__(self) -> None:
        self.logger: logging.Logger = MyLogger().get_logger()
        self.tz: pytz.BaseTzInfo = pytz.timezone("Pacific/Auckland")
        self.akahu_url = "https://api.akahu.io/v1"
        self.headers = {
            "X-Akahu-ID": os.environ["AKAHU_ID"],
            "Authorization": f"Bearer {os.environ['AUTH_TOKEN']}",
            "accept": "application/json",
        }

    @log
    @handle_missing
    def get_12_month_value(self) -> float:
        account = requests.get(
            f"{self.akahu_url}/accounts/{os.environ['ASB_12_MONTH_ID']}",
            headers=self.headers,
            timeout=5,
        ).json()
        return account["item"]["balance"]["current"]

    @log
    @handle_missing
    def get_6_month_value(self) -> float:
        account = requests.get(
            f"{self.akahu_url}/accounts/{os.environ['ASB_6_MONTH_ID']}",
            headers=self.headers,
            timeout=5,
        ).json()
        return account["item"]["balance"]["current"]

    @log
    def get_account_value(self) -> float:
        return round(self.get_12_month_value() + self.get_6_month_value(), 2)
