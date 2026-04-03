"""
JSON 기반 이벤트 데이터 관리 모듈
events.json 파일을 읽고 쓰는 유틸리티를 제공합니다.
"""

import json
import os
from pathlib import Path
from datetime import datetime

DATA_FILE = Path(__file__).parent / "events.json"


def _ensure_file():
    """events.json 파일이 없으면 빈 배열로 초기화합니다."""
    if not DATA_FILE.exists():
        DATA_FILE.write_text("[]", encoding="utf-8")


def load_events() -> list[dict]:
    """저장된 이벤트 목록을 반환합니다."""
    _ensure_file()
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_events(events: list[dict]):
    """이벤트 목록을 파일에 저장합니다."""
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(events, f, ensure_ascii=False, indent=2)


def upsert_events(new_events: list[dict]):
    """
    새로 수집한 이벤트를 기존 데이터에 병합합니다.
    - 'id' (provider + title 해시) 기준으로 중복 체크
    - 기존 이벤트의 checked 상태는 유지
    - 새 이벤트는 checked=False로 추가
    """
    existing = load_events()
    existing_map = {e["id"]: e for e in existing}

    for evt in new_events:
        if evt["id"] in existing_map:
            # 기존 이벤트: checked 상태 보존, 나머지 업데이트
            checked = existing_map[evt["id"]].get("checked", False)
            evt["checked"] = checked
        else:
            evt["checked"] = False
        existing_map[evt["id"]] = evt

    merged = list(existing_map.values())
    # 종료일 기준 정렬 (최신 먼저)
    merged.sort(key=lambda x: x.get("end_date", ""), reverse=True)
    save_events(merged)
    return merged


def toggle_checked(event_id: str) -> dict | None:
    """이벤트의 체크 상태를 토글합니다."""
    events = load_events()
    for evt in events:
        if evt["id"] == event_id:
            evt["checked"] = not evt.get("checked", False)
            save_events(events)
            return evt
    return None


def generate_event_id(provider: str, title: str) -> str:
    """운용사명과 제목으로 고유 ID를 생성합니다."""
    import hashlib
    raw = f"{provider}:{title}"
    return hashlib.md5(raw.encode()).hexdigest()[:12]
