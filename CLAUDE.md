# CLAUDE.md — O Moto Shop

@AGENTS.md

As regras de arquitetura, domínio e código estão no `AGENTS.md` (importado acima). As decisões pontuais do MVP, por domínio, estão em [`docs/decisions.md`](docs/decisions.md).

## Comandos

Use `corepack pnpm` (versão fixada em `packageManager`). Antes de entregar, rode na ordem:

```bash
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

- `corepack pnpm db:generate` gera o Prisma Client (necessário numa worktree nova; não acessa o banco).
- `corepack pnpm dev`: servidor em http://127.0.0.1:3005.
- `corepack pnpm dev:review`: servidor da revisão com dados demo em http://localhost:3001 (veja `docs/guia-de-telas.md`).
- Sem `.env.local`, o `build` precisa das variáveis de placeholder que a CI usa (`.github/workflows/ci.yml`).

## Banco de dados: cuidado

O `DATABASE_URL` do `.env.local` aponta para o banco da demo pública (o mesmo do site em produção).

- Não rode nele testes de integração (`test:integration`), E2E (`test:e2e`), `db:migrate`, `db:seed`, seeds de revisão nem scripts de remoção.
- Integração e E2E usam `TEST_DATABASE_URL`, que precisa apontar para um branch Neon de teste com host diferente do `DATABASE_URL`. Confirme isso antes de rodar.
- `test:demo` é somente leitura (navega pelas telas) e pode rodar contra o servidor da demo.
