"""add_compliance_documents_bucket_and_policies

Revision ID: bc46cb65f4e3
Revises: 144e584e476d
Create Date: 2026-06-02 19:04:21.586119

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'bc46cb65f4e3'
down_revision: Union[str, Sequence[str], None] = '144e584e476d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Create the Bucket
    op.execute("""
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES ('compliance-documents', 'compliance-documents', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/heic'])
        ON CONFLICT (id) DO UPDATE SET
            public = false,
            file_size_limit = 10485760,
            allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/heic'];
    """)

    # 2. Create the Policies
    op.execute('DROP POLICY IF EXISTS "Workers upload/update their own documents 1dwcyva_0" ON storage.objects;')
    op.execute("""
        CREATE POLICY "Workers upload/update their own documents 1dwcyva_0" 
        ON storage.objects FOR INSERT TO authenticated 
        WITH CHECK ((bucket_id = 'compliance-documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text));
    """)

    op.execute('DROP POLICY IF EXISTS "Workers upload/update their own documents 1dwcyva_1" ON storage.objects;')
    op.execute("""
        CREATE POLICY "Workers upload/update their own documents 1dwcyva_1" 
        ON storage.objects FOR UPDATE TO authenticated 
        USING ((bucket_id = 'compliance-documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text));
    """)

    op.execute('DROP POLICY IF EXISTS "Workers upload/update their own documents 1dwcyva_2" ON storage.objects;')
    op.execute("""
        CREATE POLICY "Workers upload/update their own documents 1dwcyva_2" 
        ON storage.objects FOR SELECT TO authenticated 
        USING ((bucket_id = 'compliance-documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text));
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute('DROP POLICY IF EXISTS "Workers upload/update their own documents 1dwcyva_0" ON storage.objects;')
    op.execute('DROP POLICY IF EXISTS "Workers upload/update their own documents 1dwcyva_1" ON storage.objects;')
    op.execute('DROP POLICY IF EXISTS "Workers upload/update their own documents 1dwcyva_2" ON storage.objects;')
    op.execute("DELETE FROM storage.buckets WHERE id = 'compliance-documents';")
