from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .router.ASB import router as ASBRouter
from .router.BNZ import router as BNZRouter
from .router.kernel_wealth import router as KernelRouter
from .router.sharesies import router as SharesiesRouter
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

app.include_router(ASBRouter, prefix="/asb")
app.include_router(BNZRouter, prefix="/bnz")
app.include_router(KernelRouter, prefix="/kernel")
app.include_router(SharesiesRouter, prefix="/sharesies")


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "healthy"}
