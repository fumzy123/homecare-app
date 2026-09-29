CONSENT_VERSION = "2026-09-29-v2"
CONSENT_TEXT = (
    "I authorize Care Harbor to save my card and automatically charge the selected "
    "CAD base subscription when my remaining free trial ends (or immediately if it has ended), plus $5 per additional active client "
    "above 10 per monthly billing period and applicable taxes. Annual prepayment "
    "covers only the base; additional clients are billed monthly. The 14-day trial "
    "starts when onboarding is completed or 30 days after agency signup, whichever "
    "is earlier. An existing trial keeps its original end date. Onboarding and trial visits are free. I can cancel before conversion "
    "to avoid subscription charges. After conversion, cancellation stops renewal "
    "at the end of prepaid coverage; prepaid base fees are non-refundable."
)

FOUNDING_CONSENT_VERSION = "2026-09-29-founding-v2"
FOUNDING_CONSENT_TEXT = (
    "I authorize Care Harbor to save my card and automatically charge CAD $200/month "
    "when my remaining free trial ends (or immediately if it has ended), plus CAD $4 per additional active client above 10 per monthly "
    "billing period and applicable taxes. These founding rates are guaranteed for my "
    "first 12 paid months. After that, standard rates in effect at that time apply, "
    "with at least 30 days' notice of the new rates. I agree to one 30-minute feedback "
    "session per month. The 14-day trial starts when onboarding is completed or 30 "
    "days after agency signup, whichever is earlier. An existing trial keeps its original end date. Onboarding and trial visits are "
    "free. I can cancel before conversion to avoid charges, or stop renewal after "
    "conversion at the end of prepaid coverage. Prepaid base fees are non-refundable. "
    "Founding pricing does not resume if I cancel and return."
)


def consent_for_plan(code):
    return (FOUNDING_CONSENT_VERSION, FOUNDING_CONSENT_TEXT) if code == "founding" else (CONSENT_VERSION, CONSENT_TEXT)
