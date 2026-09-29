"""Retired operator trial control; customer signup now starts the app trial."""
from app.core.exceptions import AppError


class TrialActivationService:
    def __init__(self, db, current_user=None):
        self.db = db
        self.current_user = current_user

    def request_start(self, org_id, *, now=None):
        raise AppError(410, "AUTOMATIC_TRIAL", "Trials start automatically at agency signup. Onboarding does not change billing dates.")
