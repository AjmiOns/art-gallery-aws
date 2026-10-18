const TONES: [string, string][] = [
  ['#FFD9EB', '#8F2A5F'],
  ['#E6DEFF', '#4B33B8'],
  ['#D5F4E6', '#176B49'],
  ['#FFE1D1', '#A24620'],
  ['#D8EBFF', '#235E9C'],
  ['#FFF2C4', '#6F5200'],
];

export default function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const [bg, fg] = TONES[hash % TONES.length];
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
