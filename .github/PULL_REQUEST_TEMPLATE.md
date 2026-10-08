## Resumo

<!-- O que muda e por quê. Linke a issue relacionada, se houver. -->

## Como testar

<!-- Passos, contas de demonstração e URLs para conferir a mudança. -->

1.

## Screenshots

<!-- Obrigatório para mudanças de UI: celular e desktop. Remova a seção se não houver UI. -->

| Celular | Desktop |
| ------- | ------- |
|         |         |

## Migrations

<!-- Liste as migrations novas em prisma/migrations/. Indique se são destrutivas ou exigem backfill. -->

- [ ] Sem alteração de schema
- [ ] Schema alterado **e** migration incluída neste PR

## Checklist ([AGENTS.md §64](../AGENTS.md#64-checklist-antes-de-pr))

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test` e `pnpm build` passam
- [ ] Nenhum segredo exposto (nada sensível em `NEXT_PUBLIC_*`, logs ou código)
- [ ] Permissões verificadas no servidor
- [ ] Multi-tenancy (`sellerId`/`userId` no `where`) e multi-seller considerados
- [ ] Valores monetários em centavos
- [ ] Webhooks e operações críticas idempotentes; chamadas externas com tratamento de erro
- [ ] UI com estados de loading, erro e vazio; validada no celular
- [ ] Nenhuma dependência desnecessária adicionada
- [ ] Nenhuma regra crítica apenas no client
- [ ] Decisões estruturais documentadas no `AGENTS.md`
