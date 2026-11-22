from fastapi import APIRouter

from app.services import health_service

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    return health_service.status()
