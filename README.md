# O Moto Shop

Marketplace multi-seller focado em motocross. Um checkout unificado para o cliente, dividido
internamente em um `SellerOrder` por lojista, com três experiências:

- **Storefront**: busca, categorias, Minha Moto, produto, carrinho, checkout (inclusive como convidado), pedidos,
  favoritos, avaliações e perguntas.
- **Central do Lojista**: produtos, variantes, estoque, promoções, pedidos, frete, cupons, equipe e perfil da loja.
- **Admin**: aprovação de sellers e produtos, catálogo (categorias, marcas, motos), pedidos, pós-venda, comissão, VIP,
  cupons globais, webhooks, notificações e auditoria.

Construído como **monólito modular em Next.js fullstack**. Produto, regras de negócio e arquitetura estão no
[AGENTS.md](AGENTS.md), que é a fonte principal de contexto do projeto.

## Stack

Next.js (App Router) + React + TypeScript · PostgreSQL no Neon + Prisma · Better Auth · Tailwind CSS + shadcn/ui ·
React Hook Form + Zod · Zustand + nuqs · Inngest · Upstash Redis · ImageKit · Resend · Mercado Pago · Melhor Envio ·
Sentry + Pino · Vitest + Playwright. Detalhes e justificativas em [AGENTS.md §3](AGENTS.md#3-stack-oficial).

## Requisitos

- Node.js 24
- pnpm, na versão fixada em `packageManager` (instalada pelo Corepack)
- PostgreSQL no Neon (um branch de desenvolvimento ou revisão)

## Configuração local

1. Ative o Corepack e instale as dependências:

   ```bash
   corepack enable
   pnpm install
   ```

2. Copie `.env.example` para `.env.local` e preencha:
   - `DATABASE_URL` com a URL pooled do Neon e `DIRECT_URL` com a URL direta;
   - `BETTER_AUTH_SECRET` com pelo menos 32 caracteres;
   - `ADMIN_EMAILS` com os e-mails autorizados a usar o Admin, separados por vírgula.

3. Gere o client do Prisma, aplique as migrations (somente em banco de desenvolvimento/revisão) e inicie:

   ```bash
   pnpm db:generate
   pnpm db:migrate
   pnpm db:seed
   pnpm dev
   ```

   O app sobe em `http://127.0.0.1:3005`.

Sentry, Inngest, Upstash, ImageKit, Resend, Mercado Pago e Melhor Envio são opcionais no desenvolvimento local: os
adapters falham com erro de configuração explícito se forem usados sem as variáveis correspondentes. O storage de
imagens é o **ImageKit** (`IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT`); o projeto não usa
Cloudflare R2.

## Scripts

| Script                                          | O que faz                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| `pnpm dev`                                      | Servidor de desenvolvimento em `127.0.0.1:3005`                    |
| `pnpm dev:review`                               | Servidor para revisão com dados de demonstração (`localhost:3001`) |
| `pnpm build` / `pnpm start`                     | Build e servidor de produção                                       |
| `pnpm typecheck`                                | Gera os tipos de rota (`next typegen`) e verifica tipos (`tsc`)    |
| `pnpm lint`                                     | Oxlint, com regras que usam os tipos (`.oxlintrc.json`)            |
| `pnpm format` / `pnpm format:check`             | Prettier (formatar / verificar)                                    |
| `pnpm test` / `pnpm test:watch`                 | Testes unitários (Vitest)                                          |
| `pnpm test:integration`                         | Testes de integração contra banco de teste isolado                 |
| `pnpm test:e2e`                                 | Testes de navegador (Playwright)                                   |
| `pnpm db:generate`                              | Gera o Prisma Client                                               |
| `pnpm db:migrate`                               | Cria/aplica migrations em desenvolvimento (`prisma migrate dev`)   |
| `pnpm db:deploy`                                | Aplica migrations versionadas (`prisma migrate deploy`)            |
| `pnpm db:seed` / `pnpm db:studio`               | Seed base / Prisma Studio                                          |
| `pnpm db:seed:review` / `pnpm db:remove:review` | Cria / remove os dados de demonstração para revisão                |
| `pnpm db:remove:leftovers`                      | Remove o catálogo demo antigo e as lojas de testes de QA           |
| `pnpm db:hide:review`                           | Volta as lojas de demonstração para `PENDING`                      |
| `pnpm inngest:dev`                              | Servidor local do Inngest                                          |

## Dados de demonstração e guia de telas

`pnpm db:seed:review` cria lojas, produtos, pedidos e avaliações fictícios, todos marcados como demonstração e
bloqueados para compra; `pnpm db:remove:review` remove somente esses registros. **Atenção:** o banco do `.env.local`
pode ser o de produção; sem `REVIEW_PUBLISH_STORES=true` as lojas de demonstração ficam `PENDING`. Prefira um branch
Neon isolado. Roteiro completo, contas de teste e cuidados em [docs/guia-de-telas.md](docs/guia-de-telas.md).

## Estrutura

```text
src/
├── app/          rotas e layouts do App Router (storefront, /seller, /admin, webhooks)
├── modules/      regras por domínio: auth, catalog, products, inventory, motorcycles,
│                 cart, checkout, orders, payments, shipping, coupons, returns,
│                 disputes, reviews, questions, sellers, subscriptions, notifications…
├── components/   UI compartilhada (ui/, storefront/, app-shell/)
├── shared/       contratos de providers (pagamento, frete, e-mail, storage), erros
├── lib/          infraestrutura e adapters (banco, logger, Inngest, providers)
└── config/       ambiente tipado e validado
prisma/           schema, migrations e seed
scripts/          seeds de demonstração e utilitários
tests/            unit, integration e e2e
```

Route Handlers e Server Actions apenas validam entrada e chamam a camada de aplicação; regras de negócio ficam nos
módulos ([AGENTS.md §4–5](AGENTS.md#4-arquitetura-obrigatória)).

## Documentação

| Documento                                                                      | Conteúdo                                               |
| ------------------------------------------------------------------------------ | ------------------------------------------------------ |
| [AGENTS.md](AGENTS.md)                                                         | Produto, stack, arquitetura e decisões do MVP          |
| [docs/guia-de-telas.md](docs/guia-de-telas.md)                                 | Roteiro de revisão das telas com dados de demonstração |
| [docs/mvp-checklist.md](docs/mvp-checklist.md)                                 | Checklist até a abertura pública                       |
| [docs/production-readiness.md](docs/production-readiness.md)                   | Prontidão para produção: evidências e bloqueadores     |
| [docs/critical-flow-matrix.md](docs/critical-flow-matrix.md)                   | Cenários críticos e evidências de teste                |
| [docs/manual-route-matrix.md](docs/manual-route-matrix.md)                     | Matriz de rotas e fluxos                               |
| [docs/release-inventory.md](docs/release-inventory.md)                         | Inventário da versão candidata                         |
| [docs/auditoria-2026-10.md](docs/auditoria-2026-10.md)                         | Auditoria de negócio, segurança e UI/UX                |
| [docs/auditoria-repositorio-2026-10.md](docs/auditoria-repositorio-2026-10.md) | Auditoria do repositório e plano de melhorias          |

## Contribuição, segurança e histórico

- [CONTRIBUTING.md](CONTRIBUTING.md): setup, fluxo de branch e PR, Conventional Commits e verificações obrigatórias.
- [SECURITY.md](SECURITY.md): como reportar vulnerabilidades de forma privada.
- [CHANGELOG.md](CHANGELOG.md): histórico do MVP (as antigas "Fases") e mudanças ainda não lançadas.
