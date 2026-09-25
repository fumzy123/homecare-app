import re
from pathlib import Path

from app.api.routes.legal import CURRENT_TERMS_VERSION


def test_frontend_and_backend_present_the_same_terms_version():
    frontend = Path(__file__).resolve().parents[2] / "admin-frontend/src/shared/lib/legal.ts"
    source = frontend.read_text(encoding="utf-8")
    match = re.search(r"CURRENT_TERMS_VERSION\s*=\s*['\"]([^'\"]+)['\"]", source)
    assert match is not None
    assert match.group(1) == CURRENT_TERMS_VERSION
