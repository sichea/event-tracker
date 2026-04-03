"""
매일 오전 10시에 스크래핑을 실행하는 스케줄러 모듈
APScheduler를 사용하여 서버가 실행되는 동안 예약 작업을 수행합니다.
"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import asyncio


scheduler = AsyncIOScheduler()


async def scheduled_scrape():
    """예약된 스크래핑 작업"""
    from scraper import run_scrape_and_save
    print("[스케줄러] 예약 스크래핑 시작...")
    try:
        await run_scrape_and_save()
        print("[스케줄러] 예약 스크래핑 완료")
    except Exception as e:
        print(f"[스케줄러] 스크래핑 실패: {e}")


def start_scheduler():
    """매일 오전 10시에 실행되는 스케줄러를 시작합니다."""
    scheduler.add_job(
        scheduled_scrape,
        trigger=CronTrigger(hour=10, minute=0),
        id="daily_scrape",
        name="매일 오전 10시 이벤트 수집",
        replace_existing=True,
    )
    scheduler.start()
    print("[스케줄러] 매일 오전 10시 스크래핑 예약 완료")


def stop_scheduler():
    """스케줄러를 중지합니다."""
    if scheduler.running:
        scheduler.shutdown()
        print("[스케줄러] 중지 완료")
