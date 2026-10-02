from collections import defaultdict
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from app.core.exceptions import AppError
from app.domain.attention import coverage_item, sort_items
from app.domain.scheduling import expand_occurrences, resolve_effective_occurrence, iso_week_range, shift_has_occurrence_on
from app.repositories.attention_repository import AttentionRepository
from app.repositories.organization_repository import OrganizationRepository
from app.schemas.attention import AttentionItem, AttentionTarget, AttentionResponse
from app.repositories.activity_repository import ActivityRepository
from app.core.enums import NotificationType, OVERTIME_APPROVERS
from app.schemas.attention import InterestedWorker
from app.domain.activity import notification_content


class AttentionService:
    def __init__(self, db, current_user):
        self.attention_repo = AttentionRepository(db)
        self.org_repo = OrganizationRepository(db)
        member = self.org_repo.get_active_employment_for_user(current_user.id)
        if not member:
            raise AppError(404, 'NOT_FOUND', 'Member record not found')
        self.org_id = member.org_id
        self.member = member
        self.activity_repo = ActivityRepository(db)

    def list_items(self):
        org = self.org_repo.get_by_id(self.org_id)
        tz = ZoneInfo(org.billing_timezone or 'America/St_Johns')
        today = datetime.now(tz).date()
        week_start, week_end = iso_week_range(today)
        clients = {c.id: c for c in self.attention_repo.clients(self.org_id)}
        needs = [n for n in self.attention_repo.care_needs(self.org_id, today) if n.client_id in clients]
        placements = self.attention_repo.placements(self.org_id, [n.id for n in needs])
        by_need = {p.weekly_care_need_id: p for p in placements}
        assigned = defaultdict(set)
        for placement_id, slot_id in self.attention_repo.assignments(self.org_id, [p.id for p in placements]):
            assigned[placement_id].add(slot_id)
        items = []
        for need in needs:
            placement = by_need.get(need.id)
            item = coverage_item(need, clients[need.client_id], placement, assigned[placement.id] if placement else set(), today)
            if item:
                item.total_slots = len(need.care_slots)
                item.covered_slots = len(assigned[placement.id]) if placement else 0
                if placement:
                    open_slots = {str(s.id): s for s in need.care_slots if s.id not in assigned[placement.id]}
                    for interest in placement.interests:
                        slots = [open_slots[s] for s in (interest.care_slot_ids or []) if s in open_slots]
                        if slots:
                            worker = interest.employment
                            item.interested_workers.append(InterestedWorker(id=worker.id,
                                name=f'{worker.person.first_name} {worker.person.last_name}',
                                slots=[f'{s.day_of_week.value} {s.start_time:%H:%M}–{s.end_time:%H:%M}' for s in slots]))
                items.append(item)
        for credential, worker_id, first, last in self.attention_repo.credentials(self.org_id, today):
            unverified = credential.file_url is not None and credential.verified_at is None
            due = credential.expiry_date
            items.append(AttentionItem(id=f'credential:{worker_id}:{credential.document_type.value}', category='credentials',
                stage='verify_credential' if unverified else 'renew_credential',
                urgency='urgent' if due and due <= today else 'upcoming' if due and due <= today + timedelta(days=7) else 'review',
                subject=f'{first} {last}', detail=credential.document_type.value.replace('_', ' ').capitalize(), due_on=due,
                target=AttentionTarget(kind='credential', record_id=worker_id, detail_id=credential.id, document_type=credential.document_type.value)))
        auths = self.attention_repo.authorizations(self.org_id)
        superseded = {a.supersedes_id for a in auths if a.supersedes_id}
        for auth in auths:
            if auth.client_id not in clients or auth.client.care_arrangement.value != 'funded' or auth.cancelled_at or auth.id in superseded:
                continue
            if not auth.covering_end or not (auth.covering_start <= today and auth.covering_end <= today + timedelta(days=15)):
                continue
            items.append(AttentionItem(id=f'authorization:{auth.id}', category='authorizations', stage='renew_authorization',
                urgency='urgent' if auth.covering_end <= today else 'upcoming',
                subject=f'{auth.client.first_name} {auth.client.last_name}', detail=f'{auth.funder} · {auth.authorization_number}', due_on=auth.covering_end,
                target=AttentionTarget(kind='authorization', record_id=auth.client_id, detail_id=auth.id)))
        scheduled, dropped_clients = set(), set()
        start, end = today - timedelta(days=7), today + timedelta(days=60)
        for shift in self.attention_repo.shifts(self.org_id, start, end):
            modifications = {m.original_date: m for m in shift.modifications}
            days = set(expand_occurrences(shift, start, end))
            # A rescheduled occurrence may originate outside the visible window.
            # Retain its original identity, but count it on its effective day.
            for modification in shift.modifications:
                if (modification.completion_status.value == 'dropped' or (modification.new_start_time and start <= modification.new_start_time.date() <= end)) and shift_has_occurrence_on(shift, modification.original_date):
                    days.add(modification.original_date)
            for day in days:
                effective = resolve_effective_occurrence(shift, day, modifications.get(day))
                actual_day = effective.start_time.astimezone(tz).date() if effective.start_time.tzinfo else effective.start_time.date()
                status = effective.completion_status.value
                if not start <= actual_day <= end and status != 'dropped':
                    continue
                if week_start <= actual_day <= week_end and status in {'scheduled', 'in_progress', 'completed', 'no_show'}:
                    scheduled.add(shift.client_id)
                if status == 'dropped':
                    if week_start <= actual_day <= week_end:
                        dropped_clients.add(shift.client_id)
                    items.append(AttentionItem(id=f'visit:{shift.id}:{day}', category='schedule', stage='review_dropped_visit' if actual_day < today else 'replace_worker',
                        urgency='urgent' if actual_day <= today else 'upcoming', subject=f'{shift.client.first_name} {shift.client.last_name}',
                        detail='Dropped visit · Outcome needs review' if actual_day < today else 'Dropped visit · Replacement needed', due_on=actual_day,
                        target=AttentionTarget(kind='visit', record_id=shift.id, occurrence_date=day)))
        # A weekly gap is a separate review question, not evidence of missed care.
        # Suppress it when a specific coverage case already explains that week's gap.
        coverage_needs = {i.target.detail_id for i in items if i.category == 'coverage' and i.due_on and i.due_on <= week_end}
        coverage_clients = {n.client_id for n in needs if n.id in coverage_needs}
        for client_id, client in clients.items():
            if client_id not in scheduled and client_id not in coverage_clients and client_id not in dropped_clients:
                items.append(AttentionItem(id=f'gap:{client_id}:{week_start}', category='schedule', stage='review_schedule', urgency='review',
                    subject=f'{client.first_name} {client.last_name}', detail='Active client · No visits this week',
                    target=AttentionTarget(kind='weekly_schedule', record_id=client_id, occurrence_date=week_start)))
        unread = self.activity_repo.unread_by_situation(self.member)
        fresh_interest = self.activity_repo.unread_notices(self.member)
        fresh_workers = {(n.situation_key, n.about_worker_id) for n, _ in fresh_interest}
        for item in items:
            item.unread_count = unread.get(item.id, 0)
            item.notification_ids = [n.id for n, _ in fresh_interest if n.situation_key == item.id][:100]
            for worker in item.interested_workers:
                worker.unread = (item.id, worker.id) in fresh_workers
        for request in self.activity_repo.pending_overtime(self.member):
            approver = self.member.role in OVERTIME_APPROVERS
            key = f'notice:{request.notification_id}'
            items.append(AttentionItem(id=key, category='schedule',
                stage='review_overtime' if approver else 'await_approval', urgency='review' if approver else 'waiting',
                subject='Overtime approval', detail=str(request.details.get('client_name') or 'Requested visit'),
                target=AttentionTarget(kind='overtime', record_id=request.notification_id), unread_count=unread.get(key, 0)))
        existing_keys = {i.id for i in items}
        informational = {NotificationType.profile_updated, NotificationType.billing_trial_reminder,
            NotificationType.billing_annual_reminder, NotificationType.founding_conversion_notice}
        for notice, _ in sorted(fresh_interest, key=lambda row: row[0].created_at, reverse=True):
            key = notice.situation_key or f'notice:{notice.id}'
            if notice.type not in informational or key in existing_keys:
                continue
            category, title, detail, target = notification_content(notice)
            if not target:
                continue
            items.append(AttentionItem(id=key, category=category, stage='view_update', urgency='review',
                action_required=False, subject=title, detail=detail, target=AttentionTarget(**target),
                unread_count=unread.get(key, 0), notification_ids=[n.id for n, _ in fresh_interest if n.situation_key == key][:100]))
            existing_keys.add(key)
        payments = self.activity_repo.unresolved_payments(self.member)
        for notice, _ in payments:
            key = notice.situation_key or f'notice:{notice.id}'
            items.append(AttentionItem(id=key, category='billing', stage='review_billing', urgency='urgent',
                subject='Payment needs attention', detail='Review the invoice and payment method',
                target=AttentionTarget(kind='billing', record_id=self.org_id), unread_count=unread.get(key, 0), notification_ids=[notice.id]))
        return AttentionResponse(org_id=self.org_id, checked_at=datetime.now(timezone.utc), week_start=week_start, week_end=week_end,
            items=sort_items(items), unread_count=sum(unread.values()))
