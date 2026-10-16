import { getHeroAssurances } from "../content/home-content";

export function HeroAssurances() {
  return (
    <ul
      className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/80 sm:text-sm"
      aria-label="Garantias do Moto Shop"
    >
      {getHeroAssurances().map(({ icon: Icon, text }) => (
        <li key={text} className="flex items-center gap-1.5">
          <Icon aria-hidden="true" className="text-moto-brand size-4 shrink-0" />
          {text}
        </li>
      ))}
    </ul>
  );
}
