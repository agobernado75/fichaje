export default function LogoFichaOK({ tamano = 40 }) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className="logo-fichaok"
    >
      <circle cx="32" cy="32" r="28" fill="#16a34a" />
      <circle
        cx="32"
        cy="32"
        r="28"
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="3"
      />
      <path
        d="M20 33.5 29.5 43 45 23"
        stroke="#fff"
        strokeWidth="6.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="46" cy="18" r="7" fill="#fff" />
      <path
        d="M46 15.5v3"
        stroke="#16a34a"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M46 18l2.2 1.2"
        stroke="#16a34a"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}