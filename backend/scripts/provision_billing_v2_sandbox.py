"""Create/reuse the approved prices in Stripe TEST mode only."""
from pathlib import Path
from dotenv import dotenv_values, set_key
import stripe


def main():
    env = Path(__file__).resolve().parents[1] / '.env.local'
    key = dotenv_values(env).get('STRIPE_SECRET_KEY', '')
    if not key.startswith(('sk_test_', 'rk_test_')):
        raise SystemExit('Test key required; no requests sent')
    stripe.api_key = key
    stripe.max_network_retries = 2
    for interval, amount, name in [('month', 35000, 'STRIPE_STANDARD_MONTHLY_V2_PRICE_ID'),
                                   ('year', 336000, 'STRIPE_STANDARD_ANNUAL_V2_PRICE_ID')]:
        lookup = f'care_harbor_standard_v2_{interval}_cad'
        prices = stripe.Price.list(lookup_keys=[lookup], limit=1).data
        if prices:
            price = prices[0]
        else:
            product = stripe.Product.create(name='Care Harbor Standard',
                metadata={'catalog_version': '2'}, idempotency_key='care-harbor-standard-v2-product')
            price = stripe.Price.create(product=product.id, currency='cad', unit_amount=amount,
                recurring={'interval': interval}, lookup_key=lookup,
                metadata={'plan_code': 'standard', 'plan_version': '2'}, idempotency_key=lookup)
        assert not price.livemode and price.active and price.currency == 'cad' and price.unit_amount == amount
        assert price.recurring.interval == interval and price.recurring.interval_count == 1
        set_key(str(env), name, price.id)
        print(f'{interval}: CAD {amount / 100:.2f} test price configured')


if __name__ == '__main__':
    main()
