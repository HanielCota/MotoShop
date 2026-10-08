import { trustItems } from "../content/home-content";

export function TrustStrip() {
  return (
    <section
      className="relative z-10 mx-auto -mt-12 w-full max-w-6xl px-4 sm:px-6"
      aria-label="Benefícios da plataforma"
    >
      <ul className="border-border bg-border grid gap-px overflow-hidden rounded-xl border shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        {trustItems.map(({ icon: Icon, title, text }) => (
          <li className="bg-card flex items-center gap-3 p-4 sm:p-5" key={title}>
            <Icon aria-hidden="true" className="text-moto-brand size-5 shrink-0" />
            <div>
              <strong className="block text-sm">{title}</strong>
              <span className="text-muted-foreground block text-xs leading-5">{text}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
