"""Preview by default. Execution requires a reviewed plan, exact token and receipt.

Run from backend: python -m scripts.worker_account_deletion --help
Never run against real records just to test this script.
"""
import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

from pydantic import ValidationError
from sqlalchemy.engine import make_url

from app.schemas.account_deletion import AccountDeletionPlan
from app.services.account_deletion_service import AccountDeletionService, DeletionReviewError


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", type=Path, required=True)
    parser.add_argument("--expected-environment", required=True)
    parser.add_argument("--expected-auth-host", required=True)
    parser.add_argument("--expected-db-host", required=True)
    parser.add_argument("--execute", action="store_true", help="Perform reviewed cleanup; default is read-only preview")
    parser.add_argument("--review-token")
    parser.add_argument("--receipt", type=Path, help="New JSONL audit receipt in a private directory outside the repository")
    args = parser.parse_args()
    if args.execute and (not args.review_token or not args.receipt):
        parser.error("--execute requires --review-token and --receipt")
    try:
        plan = AccountDeletionPlan.model_validate_json(args.plan.read_text(encoding="utf-8-sig"))
    except (OSError, ValidationError):
        parser.error("Cannot read a valid reviewed plan; check the runbook (input values are not logged)")

    # Delay loading configured infrastructure until all CLI inputs are validated.
    from app.core.config import settings
    if (settings.app_env != args.expected_environment
            or urlsplit(settings.supabase_url).hostname != args.expected_auth_host
            or make_url(settings.database_url).host != args.expected_db_host):
        parser.error("Configured environment/hosts do not match the explicit target; no action taken")
    from app.db.session import SessionLocal
    from app.db.supabase import get_supabase_client

    receipt = None
    try:
        if args.execute:
            # Exclusive creation prevents overwriting a previous run's audit trail.
            receipt = args.receipt.open("x", encoding="utf-8")

        def record_phase(phase):
            entry = {
                "at": datetime.now(timezone.utc).isoformat(), "phase": phase,
                "request_reference": plan.request_reference,
                "operator_reference": plan.operator_reference,
                "person_id": str(plan.person_id), "auth_user_id": str(plan.expected_auth_user_id),
                "environment": args.expected_environment,
                "review_token": args.review_token,
            }
            if phase == "started":
                entry["reviewed_plan"] = plan.model_dump(mode="json")
            receipt.write(json.dumps(entry) + "\n")
            receipt.flush()
            os.fsync(receipt.fileno())

        if receipt:
            record_phase("started")
        with SessionLocal() as db:
            # Preview never even initializes the remote Auth client.
            auth_admin = get_supabase_client().auth.admin if args.execute else None
            service = AccountDeletionService(db, auth_admin)
            result = service.execute(plan, args.review_token, record_phase=record_phase) if args.execute else service.preview(plan)
            print(json.dumps(result, indent=2))
        return 0
    except DeletionReviewError as error:
        print(str(error), file=sys.stderr)
        return 1
    except Exception:
        # Provider/database exception text may contain secrets or personal data.
        print("Cleanup did not finish cleanly. Check the receipt and follow recovery steps; do not assume rollback undid Auth deletion.", file=sys.stderr)
        return 1
    finally:
        if receipt:
            receipt.close()


if __name__ == "__main__":
    raise SystemExit(main())
