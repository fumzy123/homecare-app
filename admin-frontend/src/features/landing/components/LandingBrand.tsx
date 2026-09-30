export function LandingBrand() {
  return (
    <a href="#" className="brand" aria-label="Care Harbor home">
      <svg
        width="34"
        height="34"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
      >
        <path d="M1 1h30v30H1z" stroke="currentColor"></path>
        <path
          d="M8 24V10l8 9v-9l8 9v5"
          stroke="currentColor"
          strokeWidth="1.5"
        ></path>
        <circle cx="24" cy="7" r="2.5" fill="#FF5A1F"></circle>
      </svg>
      <span>
        Care Harbor<small>HOME CARE OS</small>
      </span>
    </a>
  )
}
