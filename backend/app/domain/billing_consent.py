CONSENT_VERSION = "2026-10-02-v5"
CONSENT_TEXT = (
    "I authorize Care Harbor to save my card and automatically charge the selected "
    "CAD base subscription when my remaining free trial ends (or immediately if it has ended), plus $10 per additional active client "
    "above 10 per monthly billing period and applicable taxes. Annual prepayment "
    "covers the base for the year ahead; additional usage is calculated monthly and collected at year-end. The renewal invoice combines the next annual base with the previous year's usage, after a 72-hour correction window. Cancelling renewal leaves a final usage-only invoice after prepaid coverage ends. Monthly plans settle additional usage monthly. The 14-day trial "
    "starts automatically when my agency account is created. Subscribing preserves "
    "the remaining trial. Trial visits are free. I can cancel before conversion "
    "to avoid subscription charges. After conversion, cancellation stops renewal "
    "at the end of prepaid coverage; prepaid base fees are non-refundable."
)

FOUNDING_CONSENT_VERSION = "2026-10-02-founding-v5"
FOUNDING_CONSENT_TEXT = (
    "I authorize Care Harbor to save my card and automatically charge CAD $200/month "
    "when my remaining free trial ends (or immediately if it has ended), plus CAD $5 per additional active client above 10 per monthly "
    "billing period and applicable taxes. These founding rates are guaranteed for my "
    "first 12 paid months. After that, standard rates in effect at that time apply, "
    "with at least 30 days' notice of the new rates. While receiving founding pricing, "
    "I agree to one 30-minute feedback session per month at a mutually agreed time "
    "and to share honest feedback, whether positive or negative. Testimonials, logo use and "
    "case studies are requested only after my agency has experienced value and are optional; declining does not affect founding pricing or access. "
    "Publishing my agency's feedback, name, logo, or a representative's name or image "
    "requires separate written approval of the final content, attribution and marketing "
    "channels. Published endorsements will disclose the discounted founding relationship. "
    "The 14-day trial starts automatically when my agency account "
    "is created. Subscribing preserves the remaining trial. Trial visits are free. I can cancel before conversion to avoid charges, or stop renewal after "
    "conversion at the end of prepaid coverage. Prepaid base fees are non-refundable. "
    "Founding pricing does not resume if I cancel and return."
)


def consent_for_plan(code):
    return (FOUNDING_CONSENT_VERSION, FOUNDING_CONSENT_TEXT) if code == "founding" else (CONSENT_VERSION, CONSENT_TEXT)
