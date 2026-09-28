"use client";

import { DesignSelect } from "@/components/ui/design-select";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import {
  ArrowRight,
  BadgeCheck,
  Bike,
  CircleCheck,
  Disc3,
  Gauge,
  MapPin,
  Menu,
  PackageCheck,
  Search,
  Shield,
  ShieldCheck,
  ShoppingBag,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import { type FormEvent, useRef, useState } from "react";

import styles from "./marketing-home.module.css";

type FitmentOption = {
  id: string;
  manufacturer: string;
  model: string;
  version: string;
  displacementCc: number;
  year: number;
};

type MarketingHomeProps = {
  fitments: FitmentOption[];
  categories: { id: string; name: string; slug: string; parentId: string | null }[];
  featuredProducts: {
    id: string;
    name: string;
    category: string;
    sellerName: string;
    price: string;
    hasPriceRange: boolean;
    href: `/products/${string}`;
    image: string | null;
    imageAlt: string;
    sponsored: boolean;
    isDemo: boolean;
  }[];
  primaryFitmentId?: string | null;
};

const categoryCards = [
  {
    title: "Peças para sua moto",
    description: "Motor, transmissão, freios e suspensão",
    eyebrow: "Manutenção & performance",
    href: "/products",
    icon: Wrench,
  },
  {
    title: "Capacetes",
    description: "Proteção para adulto e infantil",
    eyebrow: "Segurança",
    href: "/categoria/equipment-helmets",
    icon: Shield,
  },
] as const;

const essentials = [
  {
    title: "Óleos e lubrificantes",
    description: "Manutenção para cada intervalo",
    icon: Disc3,
    href: "/products?q=%C3%B3leo",
  },
  {
    title: "Filtros",
    description: "Ar e óleo para manter o motor protegido",
    icon: CircleCheck,
    href: "/products?q=filtro",
  },
  {
    title: "Freios",
    description: "Pastilhas, discos e componentes",
    icon: ShieldCheck,
    href: "/categoria/parts-brakes",
  },
  { title: "Pneus e câmaras", description: "Aderência para pista e trilha", icon: Bike, href: "/products?q=pneu" },
] as const;

export function MarketingHome({ fitments, categories, featuredProducts, primaryFitmentId }: MarketingHomeProps) {
  const router = useRouter();
  const [finderMode, setFinderMode] = useState<"motorcycle" | "search">("motorcycle");
  const [searchQuery, setSearchQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [fitmentId, setFitmentId] = useQueryState(
    "moto",
    parseAsString.withDefault("").withOptions({ history: "replace", shallow: true }),
  );
  // One fitment is the source for every field, the summary and the submitted ID.
  const selectedFitment =
    fitments.find((fitment) => fitment.id === fitmentId) ??
    fitments.find((fitment) => fitment.id === primaryFitmentId) ??
    fitments[0];
  const manufacturer = selectedFitment?.manufacturer ?? "";
  const selectedModel = selectedFitment?.model ?? "";
  const manufacturers = [...new Set(fitments.map((fitment) => fitment.manufacturer))];
  const manufacturerFitments = fitments.filter((fitment) => fitment.manufacturer === manufacturer);
  const models = [...new Set(manufacturerFitments.map((fitment) => fitment.model))];
  const modelFitments = manufacturerFitments.filter((fitment) => fitment.model === selectedModel);
  const equipment = categories.find((category) => category.slug === "equipment");
  const equipmentCategories = equipment ? categories.filter((category) => category.parentId === equipment.id) : [];
  const categoryLabels: Record<string, string> = {
    "equipment-helmets": "Capacetes",
    "equipment-boots": "Botas",
    "equipment-goggles": "Óculos de proteção",
  };
  const categoryIsActive = (href: string) =>
    !href.startsWith("/categoria/") || categories.some((category) => href === `/categoria/${category.slug}`);

  function handleManufacturerChange(value: string) {
    void setFitmentId(fitments.find((fitment) => fitment.manufacturer === value)?.id ?? null);
  }

  async function handleFitmentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFitment) return;
    // Flush the URL before leaving so Back restores the exact selection.
    await setFitmentId(selectedFitment.id);
    router.push(`/products?moto=${encodeURIComponent(selectedFitment.id)}`);
  }

  return (
    <main className={styles.page}>
      <div className={styles.announcement}>
        Compra segura · produtos de lojas especializadas · envio para todo o Brasil
      </div>

      <header
        className={styles.header}
        onKeyDown={(event) => {
          if (event.key === "Escape" && menuOpen) {
            setMenuOpen(false);
            menuButton.current?.focus();
          }
        }}
      >
        <div className={styles.navShell}>
          <Link className={styles.brand} href="/" aria-label="Moto Shop, página inicial">
            <Image
              className={styles.brandLogo}
              src="/Banner2-Sem-Fundo.png"
              alt="Moto Shop"
              width={6000}
              height={1000}
              priority
            />
          </Link>

          <nav className={styles.desktopNav} aria-label="Navegação principal">
            <Link href="/products">Comprar</Link>
            <Link href="#minha-moto">Minha Moto</Link>
            <Link href="/account/motorcycles">Minhas motos</Link>
            <Link href="#categorias">Categorias</Link>
            <Link href="/seller">Para lojistas</Link>
          </nav>

          <div className={styles.navActions}>
            <Link className={styles.sellerLink} href="/seller">
              Quero vender
            </Link>
            <Link className={styles.iconLink} href="/login" aria-label="Entrar na minha conta">
              <UserRound />
            </Link>
            <Link className={styles.iconLink} href="/cart" aria-label="Abrir carrinho">
              <ShoppingBag />
            </Link>
            <button
              ref={menuButton}
              className={styles.menuButton}
              type="button"
              aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={menuOpen}
              aria-controls="marketing-mobile-nav"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        <nav
          id="marketing-mobile-nav"
          className={styles.mobileNav}
          aria-label="Navegação mobile"
          hidden={!menuOpen}
          onClick={() => setMenuOpen(false)}
        >
          <Link href="/products">Comprar</Link>
          <Link href="#minha-moto">Minha Moto</Link>
          <Link href="/account/motorcycles">Minhas motos</Link>
          <Link href="#categorias">Categorias</Link>
          <Link href="/seller">Para lojistas</Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <Image
          className={styles.heroImage}
          src="/images/marketing/motoshop-hero.webp"
          alt="Piloto de motocross contornando uma curva em pista de terra"
          fill
          priority
          sizes="100vw"
        />
        <div className={styles.heroShade} />
        <div className={styles.heroContent}>
          <p className={styles.kicker}>Tudo para a sua próxima volta</p>
          <h1>
            A peça certa.
            <br />A trilha continua.
          </h1>
          <p className={styles.heroDescription}>
            Peças, equipamentos e acessórios de lojas especializadas, com compatibilidade clara para a sua moto.
          </p>

          <div className={styles.finder} id="minha-moto">
            <div className={styles.finderTabs} role="group" aria-label="Forma de busca">
              <button
                className={finderMode === "motorcycle" ? styles.activeTab : undefined}
                type="button"
                aria-pressed={finderMode === "motorcycle"}
                aria-controls="marketing-search-panel"
                onClick={() => setFinderMode("motorcycle")}
              >
                Comprar por moto
              </button>
              <button
                className={finderMode === "search" ? styles.activeTab : undefined}
                type="button"
                aria-pressed={finderMode === "search"}
                aria-controls="marketing-search-panel"
                onClick={() => setFinderMode("search")}
              >
                Buscar produto
              </button>
            </div>

            <div id="marketing-search-panel">
              {finderMode === "motorcycle" ? (
                <form
                  className={styles.motorcycleForm}
                  action="/products"
                  autoComplete="off"
                  onSubmit={handleFitmentSubmit}
                >
                  <label>
                    <span>Fabricante</span>
                    <DesignSelect
                      aria-label="Fabricante"
                      tone="marketing"
                      disabled={!selectedFitment}
                      value={manufacturer}
                      onValueChange={(value) => handleManufacturerChange(String(value))}
                    >
                      {manufacturers.map((name) => (
                        <option key={name}>{name}</option>
                      ))}
                    </DesignSelect>
                  </label>
                  <label>
                    <span>Modelo</span>
                    <DesignSelect
                      aria-label="Modelo"
                      tone="marketing"
                      disabled={!selectedFitment}
                      value={selectedModel}
                      onValueChange={(value) => {
                        void setFitmentId(
                          manufacturerFitments.find((fitment) => fitment.model === value)?.id ?? null,
                        );
                      }}
                    >
                      {models.map((model) => (
                        <option key={model}>{model}</option>
                      ))}
                    </DesignSelect>
                  </label>
                  <label>
                    <span>Ano e versão</span>
                    <DesignSelect
                      aria-label="Ano e versão"
                      tone="marketing"
                      disabled={!selectedFitment}
                      name="moto"
                      value={selectedFitment?.id ?? ""}
                      onValueChange={(value) => {
                        void setFitmentId(String(value));
                      }}
                    >
                      {modelFitments.map((fitment) => (
                        <option key={fitment.id} value={fitment.id}>
                          {[fitment.year, fitment.version, `${fitment.displacementCc} cc`].filter(Boolean).join(" · ")}
                        </option>
                      ))}
                    </DesignSelect>
                  </label>
                  <button type="submit" disabled={!selectedFitment}>
                    <Bike /> Ver peças
                  </button>
                  <p>
                    {selectedFitment
                      ? "Mostraremos produtos com compatibilidade cadastrada para a moto selecionada."
                      : "A seleção de motos está indisponível no momento. Use a busca por produto ou explore o catálogo."}
                  </p>
                </form>
              ) : (
                <form className={styles.searchForm} action="/products">
                  <label className={styles.visuallyHidden} htmlFor="home-search">
                    Buscar produto
                  </label>
                  <div className={styles.searchInputWrap}>
                    <input
                      id="home-search"
                      name="q"
                      type="search"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Ex.: filtro de ar"
                    />
                    {searchQuery ? (
                      <button
                        type="button"
                        className={styles.clearSearch}
                        onClick={() => setSearchQuery("")}
                        aria-label="Limpar busca"
                      >
                        <X aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                  <button type="submit">
                    <Search /> Buscar
                  </button>
                  <p>Busque por produto, marca, loja ou código da peça.</p>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.trustSection} aria-label="Benefícios da plataforma">
        <div className={styles.trustGrid}>
          <TrustItem icon={BadgeCheck} title="Lojas verificadas" text="Vendedores aprovados pela Moto Shop" />
          <TrustItem icon={ShieldCheck} title="Pedido acompanhado" text="Consulte seu pedido na plataforma" />
          <TrustItem icon={PackageCheck} title="Compatibilidade clara" text="Saiba se a peça serve antes de comprar" />
          <TrustItem icon={MapPin} title="Frete por loja" text="Consulte opções e prazos no checkout" />
        </div>
      </section>

      <section className={styles.categorySection} id="categorias">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionKicker}>Comece por aqui</p>
            <h2>O que você procura?</h2>
          </div>
          <Link href="/products">
            Ver todas as categorias <ArrowRight />
          </Link>
        </div>
        <div className={styles.categoryGrid}>
          {categoryCards
            .filter(({ href }) => categoryIsActive(href))
            .map(({ title, description, eyebrow, href, icon: Icon }) => (
              <Link className={styles.categoryCard} href={href} key={title}>
                <Icon aria-hidden="true" />
                <div>
                  <span>{eyebrow}</span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
                <ArrowRight className={styles.cardArrow} aria-hidden="true" />
              </Link>
            ))}
          {equipment && (
            <article className={styles.categoryCard}>
              <Gauge aria-hidden="true" />
              <div>
                <span>Pilotagem</span>
                <h3>Equipamentos</h3>
                <p>Escolha a categoria para explorar</p>
                <nav className={styles.equipmentLinks} aria-label="Categorias de equipamentos">
                  {equipmentCategories.map((category) => (
                    <Link key={category.id} href={`/categoria/${encodeURIComponent(category.slug)}`}>
                      {categoryLabels[category.slug] ?? category.name}
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  ))}
                  <Link href={`/categoria/${encodeURIComponent(equipment.slug)}`}>
                    Outros equipamentos
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </nav>
              </div>
            </article>
          )}
        </div>
      </section>

      <section className={styles.productsSection} aria-labelledby="featured-products-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionKicker}>Seleção da Moto Shop</p>
            <h2 id="featured-products-title">Produtos em destaque</h2>
          </div>
          <Link href="/products">
            Ver catálogo completo <ArrowRight />
          </Link>
        </div>
        {featuredProducts.length === 0 ? (
          <div className={styles.emptyProducts}>
            <p>Estamos preparando a primeira seleção de produtos das lojas aprovadas.</p>
            <Link href="/products">
              Explorar o catálogo <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div className={styles.productGrid}>
            {featuredProducts.map(
              ({ id, name, category, sellerName, price, hasPriceRange, href, image, imageAlt, sponsored, isDemo }) => (
                <article className={styles.productCard} key={id}>
                  <Link className={styles.productVisual} href={href} aria-label={`Ver ${name}`}>
                    {isDemo ? (
                      <span className={styles.mockBadge}>Demonstração</span>
                    ) : sponsored ? (
                      <span className={styles.mockBadge}>Patrocinado · VIP</span>
                    ) : null}
                    {image ? (
                      <Image src={image} alt={imageAlt} width={600} height={460} unoptimized />
                    ) : (
                      <span>Imagem em breve</span>
                    )}
                  </Link>
                  <div className={styles.productInfo}>
                    <span className={styles.productCategory}>{category}</span>
                    <h3>{name}</h3>
                    <p className={styles.productCompatibility}>{sellerName}</p>
                    <div className={styles.productPrice}>
                      <strong>{price}</strong>
                      {isDemo ? (
                        <small>Valor ilustrativo · compra indisponível</small>
                      ) : hasPriceRange ? (
                        <small>A partir de</small>
                      ) : null}
                    </div>
                    <Link className={styles.productLink} href={href}>
                      Ver produto <ArrowRight aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              ),
            )}
          </div>
        )}
      </section>

      <section className={styles.fitmentSection}>
        <div className={styles.fitmentContent}>
          <div className={styles.fitmentCopy}>
            <p className={styles.sectionKicker}>Minha Moto</p>
            <h2>
              Menos dúvida.
              <br />
              Mais tempo rodando.
            </h2>
            <p>
              Selecione sua moto para encontrar produtos com compatibilidade cadastrada. Para explorar equipamentos e
              outros itens sem esse filtro, acesse o catálogo completo.
            </p>
            <Link href="#minha-moto">
              Selecionar minha moto <ArrowRight />
            </Link>
            <Link href="/account/motorcycles">
              Gerenciar minhas motos <ArrowRight />
            </Link>
          </div>
          <div className={styles.fitmentCard}>
            <div className={styles.selectedBike}>
              <span>
                <Bike />
              </span>
              <div>
                <strong>{selectedFitment ? `${manufacturer} ${selectedModel}` : "Selecione sua moto"}</strong>
                <small>
                  {selectedFitment
                    ? [selectedFitment.year, selectedFitment.version, `${selectedFitment.displacementCc} cc`]
                        .filter(Boolean)
                        .join(" · ")
                    : "Explore o catálogo enquanto a seleção está indisponível"}
                </small>
              </div>
            </div>
            {selectedFitment && (
              <Link className={styles.fitmentRow} href={`/products?moto=${encodeURIComponent(selectedFitment.id)}`}>
                <span>
                  <CircleCheck aria-hidden="true" />
                  Peças compatíveis
                </span>
                <ArrowRight aria-hidden="true" />
              </Link>
            )}
            <Link className={styles.fitmentRow} href="/products">
              <span>
                <Search aria-hidden="true" />
                Explorar todo o catálogo
              </span>
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.essentialsSection}>
        <div className={styles.essentialsContent}>
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.sectionKicker}>Itens de recorrência</p>
              <h2>O essencial para continuar rodando</h2>
            </div>
            <Link href="/products">
              Explorar catálogo <ArrowRight />
            </Link>
          </div>
          <div className={styles.essentialsGrid}>
            {essentials
              .filter(({ href }) => categoryIsActive(href))
              .map(({ title, description, icon: Icon, href }) => (
                <Link className={styles.essentialCard} href={href} key={title}>
                  <span>
                    <Icon />
                  </span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                  <small>
                    Ver produtos <ArrowRight />
                  </small>
                </Link>
              ))}
          </div>
        </div>
      </section>

      <section className={styles.sellerSection}>
        <div className={styles.sellerContent}>
          <div>
            <p className={styles.sectionKicker}>Para lojas especializadas</p>
            <h2>Sua loja na pista certa.</h2>
            <p>
              Venda para um público que já procura motocross. Controle catálogo, estoque, pedidos e equipe em um único
              painel.
            </p>
          </div>
          <div className={styles.sellerActions}>
            <Link className={styles.primaryCta} href="/seller">
              Quero vender na Moto Shop
            </Link>
            <Link className={styles.secondaryCta} href="/login">
              Já tenho uma conta
            </Link>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div>
          <Link className={styles.brand} href="/" aria-label="Moto Shop, página inicial">
            <Image
              className={styles.brandLogo}
              src="/Banner2-Sem-Fundo.png"
              alt="Moto Shop"
              width={6000}
              height={1000}
            />
          </Link>
          <p>Marketplace especializado em motocross.</p>
        </div>
        <nav aria-label="Rodapé">
          <Link href="/products">Comprar</Link>
          <Link href="/seller">Vender</Link>
          <Link href="/orders">Pedidos</Link>
          <Link href="/login">Entrar</Link>
        </nav>
      </footer>
    </main>
  );
}

function TrustItem({ icon: Icon, title, text }: { icon: typeof BadgeCheck; title: string; text: string }) {
  return (
    <article className={styles.trustItem}>
      <Icon aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
    </article>
  );
}
