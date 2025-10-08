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
    def get_token(self, passcode: int | None) -> str | None:
        """Send an SMS notification or get a Bearer access token.

        InvestNow has the same function for sending an SMS notification, and to get a
        token. First you need to send a failing request without a passcode to trigger
        the SMS, then send a successful request using the SMS code.

        :param passcode: SMS Passcode, defaults to 123456
        :return: Confirmation of SMS notification or a Bearer access code
        """
        payload = {
            "client_id": "in_client",
            "grant_type": "password",
            "managerId": "4542",
            "username": os.environ["INVESTNOW_USER"],
            "password": os.environ["INVESTNOW_PASS"],
        }
        if passcode is not None:
            payload["passcode"] = passcode
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        res = requests.post(
            "https://loginapi.adminis.co.nz/connect/token",
            data=payload,
            headers=headers,
            timeout=5,
        )
        if res.status_code == 200:  # NOQA: PLR2004
            return res.json()["access_token"]
        return "SMS Code sent"

    @log
    @handle_missing
    def get_portfolio_value(self, token: str) -> float:
        headers = {"Authorization": f"Bearer {token}"}

        res = requests.get(
            "https://webapi.adminis.co.nz/api/portfolio/90652/trialBalance",
            headers=headers,
            timeout=5,
        ).json()
        return float(res["netAssetValue"]["value"])

    @log
    def get_account_value(self, token: str) -> float:
        return round(self.get_portfolio_value(token), 2)
