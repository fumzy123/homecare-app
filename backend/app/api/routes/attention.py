from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.security import require_admin
from app.db.session import get_db
from app.schemas.attention import AttentionResponse
from app.services.attention_service import AttentionService

router = APIRouter(tags=['Attention'])


def get_attention_service(db: Session = Depends(get_db), current_user=Depends(require_admin)):
    return AttentionService(db, current_user)


@router.get('/attention-items', response_model=AttentionResponse)
def attention_items(attention_service=Depends(get_attention_service)):
    return attention_service.list_items()
