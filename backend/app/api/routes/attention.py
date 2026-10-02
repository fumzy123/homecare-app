from datetime import date
from typing import Literal
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.security import require_admin
from app.db.session import get_db
from app.schemas.attention import AttentionResponse
from app.services.attention_service import AttentionService
from app.services.activity_service import ActivityService
from app.schemas.activity import ActivityPage, ReadActivity

router = APIRouter(tags=['Attention'])


def get_attention_service(db: Session = Depends(get_db), current_user=Depends(require_admin)):
    return AttentionService(db, current_user)


@router.get('/attention-items', response_model=AttentionResponse)
def attention_items(attention_service=Depends(get_attention_service)):
    return attention_service.list_items()


def get_activity_service(db: Session = Depends(get_db), current_user=Depends(require_admin)):
    return ActivityService(db, current_user)


@router.get('/activity', response_model=ActivityPage)
def activity(scope: Literal['mine', 'agency'] = 'agency', day: date | None = None,
             situation: str | None = Query(None, max_length=200), cursor: str | None = Query(None, max_length=150),
             limit: int = Query(30, ge=1, le=100), kind: Literal['all', 'completed', 'update'] = 'all',
             activity_service=Depends(get_activity_service)):
    return activity_service.list_entries(scope, day, situation, cursor, limit, kind)


@router.patch('/activity/read')
def read_activity(payload: ReadActivity, activity_service=Depends(get_activity_service)):
    activity_service.mark_read(payload)
    return {'ok': True}
