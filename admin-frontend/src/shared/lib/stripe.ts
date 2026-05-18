import { loadStripe } from '@stripe/stripe-js'

export const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

export const stripeAppearance = {
  theme: 'stripe' as const,
  variables: {
    colorPrimary:          '#111111',
    colorBackground:       '#F8F5EC',
    colorText:             '#111111',
    colorTextSecondary:    '#4A453E',
    colorDanger:           '#FF5A1F',
    fontFamily:            '"JetBrains Mono", ui-monospace, monospace',
    fontSizeBase:          '12px',
    borderRadius:          '0px',
    spacingUnit:           '4px',
  },
  rules: {
    '.Input': {
      border:     '1px solid #111111',
      padding:    '10px 12px',
      fontSize:   '12px',
      boxShadow:  'none',
    },
    '.Input:focus': {
      boxShadow: 'none',
      outline:   '1px solid #111111',
      border:    '1px solid #111111',
    },
    '.Label': {
      fontFamily:    'inherit',
      fontSize:      '9px',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color:         '#4A453E',
      marginBottom:  '4px',
    },
    '.Error': {
      fontSize:   '10px',
      fontFamily: 'inherit',
    },
  },
}
