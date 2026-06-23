"""Person + Employment refactor: split org_members into persons + employments

Revision ID: f1a2b3c4d5e6
Revises: d5e6f7a8b9c0
Create Date: 2026-06-05 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'd5e6f7a8b9c0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. Create persons table ──────────────────────────────────────────────
    op.create_table(
        'persons',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('supabase_user_id', postgresql.UUID(as_uuid=True), nullable=True, unique=True),
        sa.Column('first_name', sa.String, nullable=False),
        sa.Column('last_name', sa.String, nullable=False),
        sa.Column('email', sa.String, nullable=False, unique=True),
        sa.Column('phone_number', sa.String, nullable=True),
        sa.Column('gender', sa.String, nullable=True),
        sa.Column('date_of_birth', sa.Date, nullable=True),
        sa.Column('street', sa.String, nullable=True),
        sa.Column('city', sa.String, nullable=True),
        sa.Column('province', sa.String, nullable=True),
        sa.Column('postal_code', sa.String, nullable=True),
        sa.Column('availability', postgresql.JSONB, nullable=True),
        sa.Column('languages', postgresql.JSONB, nullable=True),
        sa.Column('pet_tolerance', sa.String, nullable=True),
        sa.Column('preferred_client_types', postgresql.JSONB, nullable=True),
        sa.Column('emergency_contact_name', sa.String, nullable=True),
        sa.Column('emergency_contact_phone', sa.String, nullable=True),
        sa.Column('emergency_contact_relationship', sa.String, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )

    # ── 2. Create employments table (reuse existing PG enum types) ───────────
    # Raw SQL to reference existing orgmemberrole and employmentstatus enum types.
    op.execute("""
        CREATE TABLE employments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            person_id UUID NOT NULL REFERENCES persons(id),
            org_id UUID NOT NULL REFERENCES organizations(id),
            role orgmemberrole NOT NULL,
            hire_date DATE,
            employment_status employmentstatus NOT NULL DEFAULT 'active',
            employment_type VARCHAR,
            has_vehicle BOOLEAN,
            max_hours_per_week INTEGER,
            pay_rate NUMERIC(10, 2),
            deleted_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ
        )
    """)

    # ── 3. Backfill persons from org_members ─────────────────────────────────
    op.execute("""
        INSERT INTO persons (
            id, supabase_user_id,
            first_name, last_name, email,
            phone_number, gender, date_of_birth,
            street, city, province, postal_code,
            availability, languages, pet_tolerance, preferred_client_types,
            emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
            created_at, updated_at
        )
        SELECT
            gen_random_uuid(), id,
            first_name, last_name, email,
            phone_number, gender, date_of_birth,
            street, city, province, postal_code,
            availability, languages, pet_tolerance, preferred_client_types,
            emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
            created_at, updated_at
        FROM org_members
    """)

    # ── 4. Backfill employments from org_members ─────────────────────────────
    op.execute("""
        INSERT INTO employments (
            id, person_id, org_id,
            role, hire_date, employment_status, employment_type,
            has_vehicle, max_hours_per_week, pay_rate,
            deleted_at, created_at, updated_at
        )
        SELECT
            gen_random_uuid(), p.id, om.org_id,
            om.role, om.hire_date, om.employment_status, om.employment_type,
            om.has_vehicle, om.max_hours_per_week, om.pay_rate,
            om.deleted_at, om.created_at, om.updated_at
        FROM org_members om
        JOIN persons p ON p.supabase_user_id = om.id
    """)

    # ── 5. Update organizations.owner_id (was supabase UUID, now person UUID) ─
    op.execute("""
        UPDATE organizations
        SET owner_id = p.id
        FROM persons p
        WHERE p.supabase_user_id = organizations.owner_id
    """)

    # ── 6. credentials: org_member_id → person_id ────────────────────────────
    op.add_column('credentials', sa.Column('person_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.execute("""
        UPDATE credentials
        SET person_id = p.id
        FROM persons p
        WHERE p.supabase_user_id = credentials.org_member_id
    """)
    op.alter_column('credentials', 'person_id', nullable=False)
    op.drop_constraint('credentials_org_member_id_fkey', 'credentials', type_='foreignkey')
    op.drop_constraint('uq_credential_member_type', 'credentials', type_='unique')
    op.drop_column('credentials', 'org_member_id')
    op.create_foreign_key('credentials_person_id_fkey', 'credentials', 'persons', ['person_id'], ['id'])
    op.create_unique_constraint('uq_credential_person_type', 'credentials', ['person_id', 'document_type'])

    # credentials.verified_by: org_members.id → employments.id
    op.drop_constraint('credentials_verified_by_fkey', 'credentials', type_='foreignkey')
    op.execute("""
        UPDATE credentials
        SET verified_by = e.id
        FROM persons p
        JOIN employments e ON e.person_id = p.id
        WHERE p.supabase_user_id = credentials.verified_by
          AND credentials.verified_by IS NOT NULL
    """)
    op.create_foreign_key('credentials_verified_by_fkey', 'credentials', 'employments', ['verified_by'], ['id'])

    # ── 7. shifts: worker_id + created_by ────────────────────────────────────
    op.drop_constraint('shifts_worker_id_fkey', 'shifts', type_='foreignkey')
    op.drop_constraint('shifts_created_by_fkey', 'shifts', type_='foreignkey')
    op.execute("""
        UPDATE shifts
        SET worker_id = e.id
        FROM persons p
        JOIN employments e ON e.person_id = p.id
        WHERE p.supabase_user_id = shifts.worker_id
    """)
    op.execute("""
        UPDATE shifts
        SET created_by = e.id
        FROM persons p
        JOIN employments e ON e.person_id = p.id
        WHERE p.supabase_user_id = shifts.created_by
    """)
    op.create_foreign_key('shifts_worker_id_fkey', 'shifts', 'employments', ['worker_id'], ['id'])
    op.create_foreign_key('shifts_created_by_fkey', 'shifts', 'employments', ['created_by'], ['id'])

    # ── 8. leave_records: worker_id + recorded_by ────────────────────────────
    op.drop_constraint('leave_records_worker_id_fkey', 'leave_records', type_='foreignkey')
    op.drop_constraint('leave_records_recorded_by_fkey', 'leave_records', type_='foreignkey')
    op.execute("""
        UPDATE leave_records
        SET worker_id = e.id
        FROM persons p
        JOIN employments e ON e.person_id = p.id
        WHERE p.supabase_user_id = leave_records.worker_id
    """)
    op.execute("""
        UPDATE leave_records
        SET recorded_by = e.id
        FROM persons p
        JOIN employments e ON e.person_id = p.id
        WHERE p.supabase_user_id = leave_records.recorded_by
    """)
    op.create_foreign_key('leave_records_worker_id_fkey', 'leave_records', 'employments', ['worker_id'], ['id'])
    op.create_foreign_key('leave_records_recorded_by_fkey', 'leave_records', 'employments', ['recorded_by'], ['id'])

    # ── 9. admin_notifications: worker_id + resolved_by ──────────────────────
    op.drop_constraint('admin_notifications_worker_id_fkey', 'admin_notifications', type_='foreignkey')
    op.drop_constraint('admin_notifications_resolved_by_fkey', 'admin_notifications', type_='foreignkey')
    op.execute("""
        UPDATE admin_notifications
        SET worker_id = e.id
        FROM persons p
        JOIN employments e ON e.person_id = p.id
        WHERE p.supabase_user_id = admin_notifications.worker_id
    """)
    op.execute("""
        UPDATE admin_notifications
        SET resolved_by = e.id
        FROM persons p
        JOIN employments e ON e.person_id = p.id
        WHERE p.supabase_user_id = admin_notifications.resolved_by
          AND admin_notifications.resolved_by IS NOT NULL
    """)
    op.create_foreign_key('admin_notifications_worker_id_fkey', 'admin_notifications', 'employments', ['worker_id'], ['id'])
    op.create_foreign_key('admin_notifications_resolved_by_fkey', 'admin_notifications', 'employments', ['resolved_by'], ['id'])

    # ── 10. admin_notification_reads: admin_id ───────────────────────────────
    op.drop_constraint('admin_notification_reads_admin_id_fkey', 'admin_notification_reads', type_='foreignkey')
    op.execute("""
        UPDATE admin_notification_reads
        SET admin_id = e.id
        FROM persons p
        JOIN employments e ON e.person_id = p.id
        WHERE p.supabase_user_id = admin_notification_reads.admin_id
    """)
    op.create_foreign_key('admin_notification_reads_admin_id_fkey', 'admin_notification_reads', 'employments', ['admin_id'], ['id'])

    # ── 11. invitations: invited_by ──────────────────────────────────────────
    op.drop_constraint('invitations_invited_by_fkey', 'invitations', type_='foreignkey')
    op.execute("""
        UPDATE invitations
        SET invited_by = e.id
        FROM persons p
        JOIN employments e ON e.person_id = p.id
        WHERE p.supabase_user_id = invitations.invited_by
          AND invitations.invited_by IS NOT NULL
    """)
    op.create_foreign_key('invitations_invited_by_fkey', 'invitations', 'employments', ['invited_by'], ['id'])

    # ── 12. clients: assigned_worker_id → employments.id ─────────────────────
    op.drop_constraint('clients_assigned_worker_id_fkey', 'clients', type_='foreignkey')
    op.execute("""
        UPDATE clients
        SET assigned_worker_id = e.id
        FROM persons p
        JOIN employments e ON e.person_id = p.id
        WHERE p.supabase_user_id = clients.assigned_worker_id
          AND clients.assigned_worker_id IS NOT NULL
    """)
    op.create_foreign_key('clients_assigned_worker_id_fkey', 'clients', 'employments', ['assigned_worker_id'], ['id'])

    # ── 13. Drop org_members table ───────────────────────────────────────────
    op.drop_table('org_members')


def downgrade() -> None:
    # ── Recreate org_members table ────────────────────────────────────────────
    op.execute("""
        CREATE TABLE org_members (
            id UUID PRIMARY KEY,
            first_name VARCHAR NOT NULL,
            last_name VARCHAR NOT NULL,
            email VARCHAR NOT NULL UNIQUE,
            phone_number VARCHAR,
            gender VARCHAR,
            date_of_birth DATE,
            role orgmemberrole NOT NULL,
            hire_date DATE,
            employment_status employmentstatus NOT NULL DEFAULT 'active',
            employment_type VARCHAR,
            has_vehicle BOOLEAN,
            max_hours_per_week INTEGER,
            pay_rate NUMERIC(10, 2),
            street VARCHAR,
            city VARCHAR,
            province VARCHAR,
            postal_code VARCHAR,
            availability JSONB,
            languages JSONB,
            pet_tolerance VARCHAR,
            preferred_client_types JSONB,
            emergency_contact_name VARCHAR,
            emergency_contact_phone VARCHAR,
            emergency_contact_relationship VARCHAR,
            deleted_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ,
            org_id UUID NOT NULL REFERENCES organizations(id)
        )
    """)

    # Backfill org_members from persons + employments (first employment per person)
    op.execute("""
        INSERT INTO org_members (
            id, first_name, last_name, email, phone_number, gender, date_of_birth,
            role, hire_date, employment_status, employment_type,
            has_vehicle, max_hours_per_week, pay_rate,
            street, city, province, postal_code,
            availability, languages, pet_tolerance, preferred_client_types,
            emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
            deleted_at, created_at, updated_at, org_id
        )
        SELECT DISTINCT ON (p.id)
            p.supabase_user_id, p.first_name, p.last_name, p.email,
            p.phone_number, p.gender, p.date_of_birth,
            e.role, e.hire_date, e.employment_status, e.employment_type,
            e.has_vehicle, e.max_hours_per_week, e.pay_rate,
            p.street, p.city, p.province, p.postal_code,
            p.availability, p.languages, p.pet_tolerance, p.preferred_client_types,
            p.emergency_contact_name, p.emergency_contact_phone, p.emergency_contact_relationship,
            e.deleted_at, p.created_at, p.updated_at, e.org_id
        FROM persons p
        JOIN employments e ON e.person_id = p.id
        WHERE p.supabase_user_id IS NOT NULL
        ORDER BY p.id, e.created_at ASC
    """)

    # Revert organizations.owner_id
    op.execute("""
        UPDATE organizations
        SET owner_id = p.supabase_user_id
        FROM persons p
        WHERE p.id = organizations.owner_id
    """)

    # Revert credentials.person_id → org_member_id
    op.add_column('credentials', sa.Column('org_member_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.execute("""
        UPDATE credentials
        SET org_member_id = p.supabase_user_id
        FROM persons p
        WHERE p.id = credentials.person_id
    """)
    op.alter_column('credentials', 'org_member_id', nullable=False)
    op.drop_constraint('credentials_person_id_fkey', 'credentials', type_='foreignkey')
    op.drop_constraint('uq_credential_person_type', 'credentials', type_='unique')
    op.drop_column('credentials', 'person_id')
    op.create_foreign_key('credentials_org_member_id_fkey', 'credentials', 'org_members', ['org_member_id'], ['id'])
    op.create_unique_constraint('uq_credential_member_type', 'credentials', ['org_member_id', 'document_type'])

    # Revert credentials.verified_by
    op.drop_constraint('credentials_verified_by_fkey', 'credentials', type_='foreignkey')
    op.execute("""
        UPDATE credentials
        SET verified_by = p.supabase_user_id
        FROM employments e
        JOIN persons p ON p.id = e.person_id
        WHERE e.id = credentials.verified_by
          AND credentials.verified_by IS NOT NULL
    """)
    op.create_foreign_key('credentials_verified_by_fkey', 'credentials', 'org_members', ['verified_by'], ['id'])

    # Revert shifts
    op.drop_constraint('shifts_worker_id_fkey', 'shifts', type_='foreignkey')
    op.drop_constraint('shifts_created_by_fkey', 'shifts', type_='foreignkey')
    op.execute("""
        UPDATE shifts SET worker_id = p.supabase_user_id
        FROM employments e JOIN persons p ON p.id = e.person_id
        WHERE e.id = shifts.worker_id
    """)
    op.execute("""
        UPDATE shifts SET created_by = p.supabase_user_id
        FROM employments e JOIN persons p ON p.id = e.person_id
        WHERE e.id = shifts.created_by
    """)
    op.create_foreign_key('shifts_worker_id_fkey', 'shifts', 'org_members', ['worker_id'], ['id'])
    op.create_foreign_key('shifts_created_by_fkey', 'shifts', 'org_members', ['created_by'], ['id'])

    # Revert leave_records
    op.drop_constraint('leave_records_worker_id_fkey', 'leave_records', type_='foreignkey')
    op.drop_constraint('leave_records_recorded_by_fkey', 'leave_records', type_='foreignkey')
    op.execute("""
        UPDATE leave_records SET worker_id = p.supabase_user_id
        FROM employments e JOIN persons p ON p.id = e.person_id
        WHERE e.id = leave_records.worker_id
    """)
    op.execute("""
        UPDATE leave_records SET recorded_by = p.supabase_user_id
        FROM employments e JOIN persons p ON p.id = e.person_id
        WHERE e.id = leave_records.recorded_by
    """)
    op.create_foreign_key('leave_records_worker_id_fkey', 'leave_records', 'org_members', ['worker_id'], ['id'])
    op.create_foreign_key('leave_records_recorded_by_fkey', 'leave_records', 'org_members', ['recorded_by'], ['id'])

    # Revert admin_notifications
    op.drop_constraint('admin_notifications_worker_id_fkey', 'admin_notifications', type_='foreignkey')
    op.drop_constraint('admin_notifications_resolved_by_fkey', 'admin_notifications', type_='foreignkey')
    op.execute("""
        UPDATE admin_notifications SET worker_id = p.supabase_user_id
        FROM employments e JOIN persons p ON p.id = e.person_id
        WHERE e.id = admin_notifications.worker_id
    """)
    op.execute("""
        UPDATE admin_notifications SET resolved_by = p.supabase_user_id
        FROM employments e JOIN persons p ON p.id = e.person_id
        WHERE e.id = admin_notifications.resolved_by
          AND admin_notifications.resolved_by IS NOT NULL
    """)
    op.create_foreign_key('admin_notifications_worker_id_fkey', 'admin_notifications', 'org_members', ['worker_id'], ['id'])
    op.create_foreign_key('admin_notifications_resolved_by_fkey', 'admin_notifications', 'org_members', ['resolved_by'], ['id'])

    # Revert admin_notification_reads
    op.drop_constraint('admin_notification_reads_admin_id_fkey', 'admin_notification_reads', type_='foreignkey')
    op.execute("""
        UPDATE admin_notification_reads SET admin_id = p.supabase_user_id
        FROM employments e JOIN persons p ON p.id = e.person_id
        WHERE e.id = admin_notification_reads.admin_id
    """)
    op.create_foreign_key('admin_notification_reads_admin_id_fkey', 'admin_notification_reads', 'org_members', ['admin_id'], ['id'])

    # Revert invitations
    op.drop_constraint('invitations_invited_by_fkey', 'invitations', type_='foreignkey')
    op.execute("""
        UPDATE invitations SET invited_by = p.supabase_user_id
        FROM employments e JOIN persons p ON p.id = e.person_id
        WHERE e.id = invitations.invited_by
          AND invitations.invited_by IS NOT NULL
    """)
    op.create_foreign_key('invitations_invited_by_fkey', 'invitations', 'org_members', ['invited_by'], ['id'])

    # Revert clients.assigned_worker_id
    op.drop_constraint('clients_assigned_worker_id_fkey', 'clients', type_='foreignkey')
    op.execute("""
        UPDATE clients SET assigned_worker_id = p.supabase_user_id
        FROM employments e
        JOIN persons p ON p.id = e.person_id
        WHERE e.id = clients.assigned_worker_id
          AND clients.assigned_worker_id IS NOT NULL
    """)
    op.create_foreign_key('clients_assigned_worker_id_fkey', 'clients', 'org_members', ['assigned_worker_id'], ['id'])

    # Drop new tables (employments first — it references persons)
    op.drop_table('employments')
    op.drop_table('persons')
