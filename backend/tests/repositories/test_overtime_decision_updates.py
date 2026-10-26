from datetime import datetime, timezone
from types import SimpleNamespace as NS
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.core.enums import NotificationType, OrgMemberRole
from app.models.person import Person
from app.models.employment import Employment
from app.models.admin_notification import Notification, NotificationRead
from app.models.activity import ActivityEvent, ActivityRead, OvertimeRequest
from app.repositories.activity_repository import ActivityRepository


def test_overtime_updates_are_requester_and_agency_scoped_and_disappear_when_read():
    engine = create_engine('sqlite://')
    for model in [Person, Employment, Notification, NotificationRead, ActivityEvent, ActivityRead, OvertimeRequest]:
        model.__table__.create(engine)
    org, other_org, requester, other_requester, owner = [uuid4() for _ in range(5)]
    with Session(engine) as db:
        def decision(agency=org, recipient=requester, status='approved'):
            person = Person(first_name='Avery', last_name='Demo', email=f'{uuid4()}@example.test')
            db.add(person)
            db.flush()
            worker = Employment(person_id=person.id, org_id=agency, role=OrgMemberRole.home_support_worker)
            db.add(worker)
            db.flush()
            notice = Notification(org_id=agency, type=NotificationType.overtime_approval_requested,
                                  triggered_by_id=recipient, payload={}, requires_action=False)
            db.add(notice)
            db.flush()
            notice.situation_key = f'notice:{notice.id}'
            request = OvertimeRequest(org_id=agency, notification_id=notice.id, worker_id=worker.id,
                                      requested_by=recipient, details={}, status=status)
            event = ActivityEvent(org_id=agency, actor_id=owner, situation_key=notice.situation_key,
                                  category='schedule', title=f'Overtime {status}', detail='', target={})
            db.add_all([request, event])
            db.flush()
            return event

        approved, rejected = decision(), decision(status='rejected')
        decision(recipient=other_requester)
        decision(agency=other_org)
        decision(status='pending')
        # Reading the original request before the decision does not consume the new event.
        request = db.query(OvertimeRequest).filter(OvertimeRequest.status == 'approved').first()
        db.add(NotificationRead(notification_id=request.notification_id, recipient_id=requester, read_at=datetime.now(timezone.utc)))
        db.commit()
        member = NS(id=requester, org_id=org, role=OrgMemberRole.supervisor)
        repo = ActivityRepository(db)
        assert {e.id for e, _, _ in repo.unread_overtime_decisions(member)} == {approved.id, rejected.id}
        assert repo.unread_overtime_decisions(NS(id=owner, org_id=org, role=OrgMemberRole.owner)) == []
        db.add(ActivityRead(event_id=approved.id, member_id=requester, read_at=datetime.now(timezone.utc)))
        db.commit()
        assert [e.id for e, _, _ in repo.unread_overtime_decisions(member)] == [rejected.id]
        assert db.query(ActivityEvent).filter(ActivityEvent.id == approved.id).count() == 1
    engine.dispose()
