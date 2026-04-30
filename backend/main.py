"""
ETF Event Tracker - FastAPI 서버
이벤트 조회 및 참여 상태 관리 API를 제공합니다.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from db import load_events, toggle_checked, save_events
from scheduler import start_scheduler, stop_scheduler
from scraper import PROVIDERS
from ai_analyzer import analyze_with_ai


@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작 시 스케줄러 시작, 종료 시 스케줄러 중지"""
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title="ETF Event Tracker",
    description="4개 ETF 운용사의 이벤트를 자동으로 수집하고 관리합니다.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS 설정 (프론트엔드에서 접근 허용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class EventFilter(BaseModel):
    provider: str | None = None
    status: str | None = None


@app.get("/")
async def root():
    return {"message": "ETF Event Tracker API", "version": "1.0.0"}


@app.get("/api/events")
async def get_events(provider: str | None = None, status: str | None = None):
    """이벤트 목록을 조회합니다. 선택적으로 운용사/상태별 필터링 가능."""
    events = load_events()

    if provider:
        events = [e for e in events if e["provider"] == provider.upper()]

    if status:
        events = [e for e in events if e["status"] == status]

    return {
        "total": len(events),
        "events": events,
    }


@app.get("/api/providers")
async def get_providers():
    """지원하는 운용사 목록을 반환합니다."""
    return {"providers": PROVIDERS}


@app.patch("/api/events/{event_id}/toggle")
async def toggle_event_checked(event_id: str):
    """이벤트의 참여 완료 상태를 토글합니다."""
    result = toggle_checked(event_id)
    if result is None:
        raise HTTPException(status_code=404, detail="이벤트를 찾을 수 없습니다.")
    return {
        "message": "상태 변경 완료",
        "event": result,
    }


@app.post("/api/scrape")
async def trigger_scrape():
    """수동으로 스크래핑을 실행합니다."""
    from scraper import run_scrape_and_save

    try:
        events = await run_scrape_and_save()
        return {
            "message": f"스크래핑 완료: {len(events)}건 수집",
            "count": len(events),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"스크래핑 실패: {str(e)}")


@app.get("/api/stats")
async def get_stats():
    """이벤트 통계를 반환합니다."""
    events = load_events()

    stats = {
        "total": len(events),
        "active": len([e for e in events if e.get("status") == "진행중"]),
        "ended": len([e for e in events if e.get("status") == "종료"]),
        "checked": len([e for e in events if e.get("checked", False)]),
        "by_provider": {},
    }

    for provider in PROVIDERS:
        provider_events = [e for e in events if e["provider"] == provider]
        stats["by_provider"][provider] = {
            "total": len(provider_events),
            "active": len([e for e in provider_events if e.get("status") == "진행중"]),
            "checked": len([e for e in provider_events if e.get("checked", False)]),
        }

    return stats
    

class AnalysisRequest(BaseModel):
    scenario: str


@app.post("/api/analyze")
async def analyze_market_scenario(request: AnalysisRequest):
    """사용자가 입력한 시나리오를 AI로 분석합니다."""
    try:
        result = await analyze_with_ai(request.scenario)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
