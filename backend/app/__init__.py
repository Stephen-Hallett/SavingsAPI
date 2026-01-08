from datetime import date

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .router.ASB import router as ASBRouter
from .router.ASB import save_data as save_asb
from .router.BNZ import router as BNZRouter
from .router.BNZ import save_data as save_bnz
from .router.investnow import router as InvestnowRouter
from .router.kernel_wealth import router as KernelRouter
from .router.kernel_wealth import save_data as save_kernel
from .router.sharesies import router as SharesiesRouter
from .router.sharesies import save_data as save_sharesies
from .router.simplicity import router as SimplicityRouter
from .router.simplicity import save_data as save_simplicity
from .utils.db import SavingsDB
from .utils.logger import MyLogger

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger = MyLogger().get_logger()
db_con = SavingsDB()

app.include_router(ASBRouter, prefix="/asb")
app.include_router(BNZRouter, prefix="/bnz")
app.include_router(KernelRouter, prefix="/kernel")
app.include_router(SharesiesRouter, prefix="/sharesies")
app.include_router(SimplicityRouter, prefix="/simplicity")
app.include_router(InvestnowRouter, prefix="/investnow")


@app.get("/portfolio")
def portfolio_value() -> dict[str, dict | float | None]:
    print("Getting portfolio value")
    return db_con.current_portfolio()


@app.post("/portfolio")
def save_portfolio() -> str:
    save_asb()
    save_bnz()
    save_kernel()
    save_sharesies()
    save_simplicity()
    return "Portfolio Updated"


@app.get("/history")
def history(
    days: int = 0, months: int = 0, years: int = 0
) -> list[dict[str, float | str | date]]:
    print("Getting portfolio history")
    history_days = days + months * 30 + years * 365  # Not perfect, but fine
    return db_con.get_history(history_days)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "healthy"}
