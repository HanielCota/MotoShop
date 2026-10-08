# Como contribuir — O Moto Shop

Antes de qualquer alteração, leia o [AGENTS.md](AGENTS.md): ele define produto, stack e arquitetura e tem prioridade
sobre convenções genéricas.

## Ambiente

Requisitos: Node.js 24 e pnpm (versão fixada em `packageManager` no `package.json`, instalada pelo Corepack).

```bash
corepack enable
pnpm install
cp .env.example .env.local   # preencha DATABASE_URL, DIRECT_URL, BETTER_AUTH_SECRET e ADMIN_EMAILS
pnpm db:generate
pnpm dev                     # http://127.0.0.1:3005
```

- Integrações (Mercado Pago, Melhor Envio, ImageKit, Resend, Inngest, Upstash, Sentry) são opcionais no
  desenvolvimento; os adapters falham com erro de configuração explícito se usados sem as variáveis.
- `pnpm db:migrate` (`prisma migrate dev`) só deve rodar contra um banco de **desenvolvimento ou revisão**
  (por exemplo, um branch Neon). Nunca contra produção.
- O worker local do Inngest sobe com `pnpm inngest:dev`.

## Dados de demonstração

```bash
pnpm db:seed:review     # cria lojas, produtos e pedidos de demonstração (idempotente)
pnpm db:remove:review   # remove somente os dados de demonstração
```

> **Atenção:** o banco configurado no `.env.local` pode ser o de **produção**. Sem `REVIEW_PUBLISH_STORES=true`, as
> lojas de demonstração ficam `PENDING` (invisíveis). Prefira um branch Neon isolado para revisar. O passo a passo e as
> contas de teste estão em [docs/guia-de-telas.md](docs/guia-de-telas.md).

## Fluxo de trabalho

1. Crie uma branch a partir de `main` (`feat/...`, `fix/...`, `docs/...`).
2. **Nunca faça push direto em `main`.** Toda mudança entra por Pull Request revisado pelo responsável.
3. Faça commits atômicos: cada commit resolve uma coisa e deixa o projeto compilando.
4. Use [Conventional Commits](https://www.conventionalcommits.org/):

   ```text
   feat(checkout): exibe frete por seller
   fix(payments): trata timeout do provider como pendente
   refactor(catalog): extrai consulta de ranking
   docs: atualiza guia de telas
   test(coupons): cobre limite por cliente
   chore(deps): atualiza prisma
   ```

   Tipos aceitos: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`. O escopo é o módulo de domínio afetado.

5. Abra o PR usando o template e preencha o checklist.

## Migrations

**Toda alteração em `prisma/schema.prisma` vai acompanhada da migration correspondente no mesmo PR.** Gere a migration
com `pnpm db:migrate` em um banco de desenvolvimento, versione a pasta criada em `prisma/migrations/` e descreva no PR
se ela é destrutiva ou exige backfill. Em produção, apenas `pnpm db:deploy` aplica migrations.

## Verificações obrigatórias

Rode antes de abrir o PR (o CI executa as mesmas):

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
```

Mudanças em fluxos críticos (checkout, pagamento, estoque, permissões) também devem considerar
`pnpm test:integration` (banco de teste isolado) e `pnpm test:e2e`.

## Checklist de PR

O checklist completo está no [AGENTS.md §64](AGENTS.md#64-checklist-antes-de-pr) e resumido no template de PR.

## Segurança

Vulnerabilidades são reportadas de forma privada, conforme o [SECURITY.md](SECURITY.md). Não abra issue pública.
