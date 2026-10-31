const paths = {
  chart: "M4 4v16h16M8 15v-4M13 15V7M18 15v-7",
  grid: "M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h6v6h-6z",
  plus: "M12 5v14M5 12h14",
  arrow: "M5 12h14M13 6l6 6-6 6",
  link: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2",
  copy: "M9 9h12v12H9zM15 5V3H3v12h2",
  check: "m5 12 4 4L19 6",
  exit: "M9 4H4v16h5M9 12h12M16 7l5 5-5 5",
  palette:
    "M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-4c-1-1 0-3 2-3h2a3 3 0 0 0 3-3 9 9 0 0 0-9-8ZM7 9h.01M12 6h.01M17 9h.01M6 14h.01",
};

export function Icon({ name }: { name: keyof typeof paths }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <title>{name}</title>
      <path d={paths[name]} />
    </svg>
  );
}
