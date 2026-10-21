# Auditoria do repositório — O Moto Shop

Data: 07/10/2026 · Branch analisada: `codex/moto-shop-readiness` · Remoto: `github.com/HanielCota/MotoShop` (privado)

Escopo: código, dependências, configuração, automação, segurança da cadeia de suprimentos e processo. Esta etapa é **somente diagnóstico e plano**; nada aqui foi aplicado (exceto o que já constava na revisão de código anterior, registrada em `docs/auditoria-2026-10.md`).

**Como os fatos foram obtidos** (verificados nesta data):

- Estrutura e Git: `git status`, `git ls-files`, `git log`, varredura de padrões de segredo em todo o histórico.
- Versões: `node_modules/*/package.json` (instaladas) × registry do npm (`dist-tags.latest`) consultado em 07/10/2026.
- Vulnerabilidades: endpoint oficial de advisories do npm (`/-/npm/v1/security/advisories/bulk`), cruzado com o `pnpm-lock.yaml` para descartar versões que só existem em cache local.
- Node.js: `nodejs.org/dist/index.json` e `nodejs/Release/schedule.json`.
- GitHub: a API pública responde 404/401 porque o repositório é privado e não há `gh` autenticado nesta máquina. **Todas as configurações administrativas ficaram como "não foi possível verificar".**

---

## A. Resumo executivo

O código está em bom estado técnico: TypeScript `strict` com `noUncheckedIndexedAccess` e `exactOptionalPropertyTypes`, monólito modular coerente com o `AGENTS.md`, 759 testes unitários passando, lint limpo e `next build` concluído. Os riscos principais são **de processo e configuração**:

1. **Não existe nenhuma automação no GitHub.** Não há `.github/`: sem CI, sem Dependabot, sem CodeQL, sem templates, sem CODEOWNERS. Nada impede que código que não compila chegue à `main`. Isso de fato aconteceu: a revisão anterior encontrou 11 erros de TypeScript escondidos por tipos de rota obsoletos.
2. **Trabalho grande e não versionado.** A branch tem cerca de 180 arquivos modificados e dezenas de arquivos novos fora do Git, incluindo **duas migrations do Prisma**. Uma perda de máquina perde o trabalho; um deploy a partir do Git sobe código que depende de tabelas que as migrations versionadas não criam.
3. **Dependências com vulnerabilidades conhecidas no lockfile.** `sharp` (alta, dependência direta, correção trivial) e `proxy-addr` (crítica no advisory, mas não alcançável em runtime pelo app) são as relevantes.
4. **Sem headers de segurança HTTP** (CSP, `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors`) num app que trata pagamento e dados pessoais.

As oportunidades são baratas: um único workflow de CI, `dependabot.yml`, CodeQL padrão, `.gitattributes` e pequenos ajustes de dependências resolvem a maior parte em um dia de trabalho, sem nova infraestrutura.

---

## B. Diagnóstico técnico

| Item            | Encontrado                                                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Tipo            | Projeto único (não é monorepo); `pnpm-workspace.yaml` existe só para `allowBuilds`, `overrides` e `minimumReleaseAgeExclude`            |
| Runtime         | Node.js 24 (local v24.21.0; README pede "24+"); **sem `engines`, `.nvmrc` ou `.node-version`**                                          |
| Gerenciador     | pnpm, `packageManager: pnpm@12.3.4`, `pnpm-lock.yaml` versionado. pnpm não está no PATH desta máquina (Corepack não habilitado)         |
| Framework       | Next.js 16.3.8 (App Router, `typedRoutes`), React 19.2.8, TypeScript 5.9.3                                                              |
| Dados           | Prisma 7.10.0 + `@prisma/adapter-neon`, PostgreSQL Neon; 32 migrations no disco, **30 versionadas**                                     |
| Auth            | Better Auth 1.7.3                                                                                                                       |
| UI              | Tailwind 4.3.3, shadcn 4.21 (CLI + `shadcn/tailwind.css`), Base UI, Lucide                                                              |
| Integrações     | Mercado Pago (REST próprio), Melhor Envio, ImageKit, Resend, Inngest 4.20, Upstash, Sentry 10.73                                        |
| Qualidade       | ESLint 9 (`eslint-config-next`), Prettier 3 + plugin Tailwind, Vitest 4 (unit + integration), Playwright 1.63 (e2e, desktop e Pixel 7)  |
| Infra           | Vercel (pasta `.vercel` local, `.vercelignore`); sem Docker (não aplicável); `neon.ts` com config-as-code de branches                   |
| Observabilidade | Sentry (server/edge/client, `tracesSampleRate 0.1`), Pino estruturado; `console.log` fora de testes: 0                                  |
| Tipagem         | `any` explícito em `src`: 0                                                                                                             |
| Documentação    | README (37 KB, histórico por fases), AGENTS.md (63 KB, regras de domínio), `docs/` com matrizes de fluxo, checklist de MVP e auditorias |

**Pontos fortes verificados:**

- Arquitetura por domínio.
- Validação com Zod nas bordas.
- Testes de integração e e2e isolados por banco próprio e contas `@example.test`. O `playwright.config.ts` recusa alvo remoto para não tocar produção.
- Lockfile com `overrides` de segurança já aplicados.
- `minimumReleaseAgeExclude` indica política de idade mínima de release (boa defesa de supply chain).
- Nenhum segredo real encontrado no histórico: as ocorrências são fixtures `db.test`/`example.test` e o placeholder do `.env.example`.

---

## C. Problemas identificados

| #   | Categoria                   | Sev.            | Onde                                                                                                                  | Evidência                                                                                                                                                                 | Impacto                                                                                                                                                                                      | Solução                                                                                                    |
| --- | --------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | Processo / perda de dados   | **Crítica**     | Branch `codex/moto-shop-readiness`                                                                                    | `git status`: cerca de 180 arquivos `M` e dezenas `??`, incluindo `prisma/migrations/20261002100000_durable_event_outbox/` e `20261002103000_shipment_generation_safety/` | Trabalho não recuperável se a máquina falhar. Um deploy a partir do Git quebraria em runtime: o código usa `outbox` e os campos de geração de etiqueta, que não existem no schema versionado | Revisar e commitar em commits lógicos (migrations + schema primeiro), fazer push e abrir PR para `main`    |
| 2   | CI/CD                       | **Alta**        | Raiz                                                                                                                  | `.github/` inexistente; API de workflows inacessível                                                                                                                      | Nenhuma barreira automática para typecheck, lint, teste ou build antes do merge                                                                                                              | Workflow `ci.yml` com typecheck, lint, testes unitários e `next build` (P1-1)                              |
| 3   | Dependências                | **Alta**        | `sharp@0.35.4` (dependência direta)                                                                                   | Advisory GHSA-wq5f-xc86-pv6w (librsvg, CVE-2026-96889), corrigido em 0.35.5                                                                                               | Processamento de imagem do `next/image` em ambiente self-hosted; no Vercel a otimização roda na infraestrutura deles, mas a dependência segue vulnerável                                     | `sharp` → 0.35.5                                                                                           |
| 4   | Dependências                | Média           | `proxy-addr@2.0.7` via `express@5.2.1`, puxado por `@modelcontextprotocol/sdk` (do `shadcn`) e pelo peer do `inngest` | Advisory GHSA-jqcg-44mw-7w3h (crítica: spoofing de IP em subnet IPv4-mapeada)                                                                                             | Não é alcançável pelo app: o Express não serve requisições do Moto Shop. Mesmo assim, entra na árvore de produção porque `shadcn` está em `dependencies`                                     | Override `proxy-addr: ^2.0.8` e mover `shadcn` para `devDependencies`                                      |
| 5   | Dependências (build)        | Baixa           | `source-map-js@1.2.1` (Tailwind/PostCSS), `braces@3.0.3` (micromatch/fast-glob)                                       | Advisories de DoS (GHSA-68fv-2mgg-jv7q, GHSA-vfj7-8cjw-p6xm)                                                                                                              | Só no build e no tooling, com entrada controlada pelo projeto                                                                                                                                | Atualizar via Dependabot quando as dependências-mãe publicarem correção, ou usar override                  |
| 6   | Segurança HTTP              | **Alta**        | `next.config.ts`; sem `proxy.ts`/`middleware.ts`                                                                      | Nenhum `headers()` configurado                                                                                                                                            | Sem CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` ou `frame-ancestors`; clickjacking possível no checkout                                                           | `headers()` com política mínima; CSP primeiro em `Report-Only` (Secure Fields do Mercado Pago usa iframes) |
| 7   | Supply chain                | Média           | GitHub                                                                                                                | Sem `dependabot.yml`, CodeQL ou dependency review                                                                                                                         | Vulnerabilidades como as dos itens 3–5 só são vistas em auditoria manual                                                                                                                     | `dependabot.yml` (npm + github-actions), CodeQL padrão, `dependency-review-action` no PR                   |
| 8   | Reprodutibilidade           | Média           | `package.json`                                                                                                        | Sem `engines`; sem `.nvmrc`; Corepack não habilitado (pnpm ausente do PATH)                                                                                               | Versões diferentes de Node/pnpm entre máquinas, CI e Vercel                                                                                                                                  | `"engines": { "node": ">=24 <25" }`, `.nvmrc` com `24` e `corepack enable` documentado                     |
| 9   | Formatação / EOL            | Média           | Repo                                                                                                                  | `core.autocrlf=true`, sem `.gitattributes`. `prettier --check`: 135 arquivos; ignorando fim de linha, ainda 74                                                            | Diffs ruidosos e `format:check` inutilizável no CI                                                                                                                                           | `.gitattributes` com `* text=auto eol=lf`, `git add --renormalize .`, `pnpm format` num commit isolado     |
| 10  | Config                      | Baixa           | `tsconfig.json` `include`                                                                                             | Inclui `.next-e2e/**` e `.next-build-check/**`                                                                                                                            | Tipos de rota obsoletos de um build antigo podem mascarar erros. Foi a causa dos 11 erros escondidos na revisão anterior                                                                     | Manter só `.next/types/**` e `.next/dev/types/**`; gerar com `next typegen` no CI antes do `tsc`           |
| 11  | Dependências desnecessárias | Baixa           | `package.json`                                                                                                        | `@neon/env` sem nenhum uso; `@neon/config` usado só por `neon.ts` (tooling); `shadcn` (CLI) em `dependencies`, usado só pelo import CSS no build                          | Superfície e tamanho maiores na árvore de produção                                                                                                                                           | Remover `@neon/env`; mover `@neon/config` e `shadcn` para `devDependencies`                                |
| 12  | Higiene do repo             | Baixa           | `.agents/` (20 arquivos) e `skills-lock.json`                                                                         | Ambos versionados, embora listados no `.gitignore`                                                                                                                        | Confusão sobre o que pertence ao repositório                                                                                                                                                 | Decidir: versionar de propósito (e tirar do `.gitignore`) ou `git rm --cached`                             |
| 13  | Documentação                | Baixa           | `README.md`                                                                                                           | Ainda cita "R2" como integração opcional; o AGENTS.md diz que R2 não é usado                                                                                              | Onboarding incorreto                                                                                                                                                                         | Atualizar o README; resumir as "Fases" num CHANGELOG                                                       |
| 14  | Governança                  | Não verificável | GitHub (privado)                                                                                                      | API 404/401 sem autenticação                                                                                                                                              | Não se sabe se `main` aceita push direto, force-push ou merge sem revisão                                                                                                                    | Conferir no painel (ver seção E)                                                                           |
| 15  | Organização                 | Baixa           | Raiz                                                                                                                  | Sem `SECURITY.md`, `CONTRIBUTING.md`, templates de PR/issue, CODEOWNERS, LICENSE                                                                                          | Processo implícito; colaboradores e agentes sem roteiro                                                                                                                                      | Itens P3 (ver seção F)                                                                                     |

Referências: [Next.js: `headers`](https://nextjs.org/docs/app/api-reference/config/next-config-js/headers) · [GitHub: Dependabot](https://docs.github.com/code-security/dependabot) · [GitHub: CodeQL default setup](https://docs.github.com/code-security/code-scanning) · [actions/dependency-review-action](https://github.com/actions/dependency-review-action) · [Node.js Release schedule](https://github.com/nodejs/Release).

---

## D. Atualizações recomendadas

Versões verificadas no registry do npm em 07/10/2026. "Patch/minor" segue semver e é de baixo risco; "major" exige leitura do guia de migração antes.

| Tecnologia                                                                                       | Atual                       | Recomendada        | Compatibilidade                                                 | Ação                                                                                                 |
| ------------------------------------------------------------------------------------------------ | --------------------------- | ------------------ | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| sharp                                                                                            | 0.35.4                      | **0.35.5**         | patch, corrige advisory                                         | **Atualizar já (P0)**                                                                                |
| proxy-addr (transitiva)                                                                          | 2.0.7                       | 2.0.8              | patch                                                           | Override no `pnpm-workspace.yaml`                                                                    |
| next / eslint-config-next                                                                        | 16.3.8                      | 16.4.0             | minor                                                           | Atualizar juntos; rodar build e e2e                                                                  |
| react / react-dom / @types/react(-dom)                                                           | 19.2.8                      | 19.3.0             | minor                                                           | Atualizar juntos                                                                                     |
| better-auth / @better-auth/prisma-adapter                                                        | 1.7.3                       | 1.7.7              | patch                                                           | Atualizar (auth: priorizar patches)                                                                  |
| zod                                                                                              | 4.5.4                       | 4.6.5              | minor                                                           | Atualizar                                                                                            |
| inngest                                                                                          | 4.20.0                      | 4.22.0             | minor                                                           | Atualizar; conferir `RetryAfterError`                                                                |
| resend                                                                                           | 6.26.0                      | 6.32.1             | minor                                                           | Atualizar                                                                                            |
| @upstash/redis, pino, react-hook-form, lucide-react, @tanstack/react-table, shadcn, @neon/config | —                           | latest minor/patch | minor/patch                                                     | Atualizar em lote via Dependabot                                                                     |
| @playwright/test                                                                                 | 1.63.0                      | 1.64.0             | minor                                                           | Atualizar com os browsers (`playwright install`)                                                     |
| prettier, tsx, jsdom, pino-pretty, react-email, @vitejs/plugin-react                             | —                           | latest patch/minor | patch/minor                                                     | Atualizar em lote                                                                                    |
| Node.js                                                                                          | 24.x (Active LTS "Krypton") | **manter 24**      | Manutenção a partir de 20/10/2026, suporte até 30/04/2028       | Fixar via `engines`/`.nvmrc`. Avaliar o 26 depois de virar LTS (28/10/2026) e de o Vercel suportá-lo |
| @types/node                                                                                      | 24.13.3                     | manter 24.x        | deve seguir o runtime                                           | Não subir para 26 enquanto o runtime for 24                                                          |
| @sentry/nextjs                                                                                   | 10.73.0                     | 11.5.0             | **major**                                                       | Ler o guia de migração 10→11; PR dedicado                                                            |
| eslint                                                                                           | 9.39.5                      | 10.12.0            | **major**                                                       | Esperar o `eslint-config-next` declarar suporte                                                      |
| vitest                                                                                           | 4.1.11                      | 5.0.3              | **major**                                                       | PR dedicado; 137 arquivos de teste como rede de proteção                                             |
| typescript                                                                                       | 5.9.3                       | 7.0.2              | **major** (compilador nativo)                                   | Não atualizar ainda: validar suporte do Next/plugin `next` e do ESLint                               |
| dotenv                                                                                           | 17.4.2                      | 18.0.6             | major                                                           | Usado só em scripts e testes; baixo valor, adiar                                                     |
| prisma / @prisma/client                                                                          | 7.10.0                      | **manter 7.10.0**  | o `latest` do npm aponta para `8.0.0-rc.21` (release candidate) | Não atualizar; aguardar o 8.0 estável                                                                |
| pnpm                                                                                             | 12.3.4                      | 12.10.1            | minor                                                           | Atualizar `packageManager`                                                                           |

---

## E. Configurações do GitHub

| Configuração                                  | Status                                          | Observação                                                                                     |
| --------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Workflows de CI (lint, tipos, testes, build)  | **Ausente**                                     | Não há `.github/workflows`                                                                     |
| Workflows de CD                               | Não aplicável                                   | Deploy pela integração Git do Vercel (não verificável aqui); não criar CD próprio              |
| Dependency review em PR                       | **Ausente**                                     | —                                                                                              |
| Dependabot version updates (`dependabot.yml`) | **Ausente**                                     | —                                                                                              |
| Dependabot alerts / security updates          | Não foi possível verificar                      | Painel: Settings → Code security                                                               |
| CodeQL / code scanning                        | **Ausente** (nenhum workflow)                   | Em repo privado, o default setup exige GitHub Advanced Security / Code Security                |
| Secret scanning e push protection             | Não foi possível verificar                      | Idem; recomendado ativar                                                                       |
| Branch protection / rulesets em `main`        | Não foi possível verificar                      | API exige autenticação                                                                         |
| Reviews obrigatórios / CODEOWNERS             | **Ausente** (arquivo) / não verificável (regra) | —                                                                                              |
| Permissões mínimas do `GITHUB_TOKEN`          | Não aplicável hoje                              | Definir `permissions: contents: read` nos workflows novos                                      |
| Pinning de actions por SHA                    | Não aplicável hoje                              | Fixar por SHA nos workflows novos                                                              |
| Environments protegidos (secrets de produção) | Não foi possível verificar                      | Secrets de produção ficam no Vercel; não colocá-los no GitHub sem necessidade                  |
| Templates de PR/issue                         | **Ausente**                                     | —                                                                                              |
| CONTRIBUTING / SECURITY / CODE_OF_CONDUCT     | **Ausente**                                     | CODE_OF_CONDUCT é opcional (repo privado, time pequeno)                                        |
| LICENSE                                       | Ausente — **adequado**                          | Repo privado, `"private": true`; opcionalmente `"license": "UNLICENSED"` no `package.json`     |
| Convenção de commits                          | Necessita melhorias                             | Histórico já usa `feat:`/`fix:`/`chore:`, mas sem verificação automática                       |
| Changelog / versionamento                     | Necessita melhorias                             | O README cumpre o papel de changelog; app de deploy contínuo dispensa release semântico formal |
| `.gitattributes`                              | **Ausente**                                     | Causa do ruído de CRLF                                                                         |

---

## F. Plano de implementação

Cada ação lista esforço (P/M/G), impacto, risco e critério de conclusão. Itens que mexem em configurações administrativas do GitHub ou do Vercel dependem de você.

### P0 — Crítico

| #    | Ação                                                                                                                                                                                | Esforço | Impacto    | Risco                         | Concluído quando                                                                           |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------- | ----------------------------- | ------------------------------------------------------------------------------------------ |
| P0-1 | Versionar o trabalho pendente: commits lógicos (1. `schema.prisma` + 2 migrations; 2. domínio/aplicação; 3. UI; 4. docs), push e PR para `main`                                     | M       | Muito alto | Baixo (só adiciona histórico) | `git status` limpo; PR aberto; `prisma migrate deploy` aplicado num branch Neon de preview |
| P0-2 | `sharp` → 0.35.5 e override `proxy-addr` → ^2.0.8                                                                                                                                   | P       | Alto       | Muito baixo                   | Consulta de advisories sem sharp/proxy-addr; build verde                                   |
| P0-3 | Conferir no painel do GitHub: secret scanning + push protection, Dependabot alerts, proteção da `main` (PR obrigatório, sem force-push, checks obrigatórios assim que o CI existir) | P       | Alto       | Nenhum                        | Regras visíveis em Settings → Rules                                                        |

### P1 — Alta prioridade

| #    | Ação                                                                                                                                                                                                                                                                                                                                                                                                                           | Esforço | Impacto    | Risco                                                            | Concluído quando                                                  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | ---------- | ---------------------------------------------------------------- | ----------------------------------------------------------------- |
| P1-1 | `.github/workflows/ci.yml`. Gatilhos: `pull_request` e `push` em `main`. `permissions: contents: read`. `concurrency` cancelando execuções antigas. `pnpm/action-setup` + `actions/setup-node` (cache pnpm, Node do `.nvmrc`). Passos: `pnpm install --frozen-lockfile` → `prisma generate` → `next typegen` → `tsc` → `eslint` → `prettier --check` → `vitest run` → `next build` com env de exemplo. Actions fixadas por SHA | M       | Muito alto | Baixo                                                            | Workflow verde no PR e marcado como check obrigatório             |
| P1-2 | `.github/dependabot.yml` (npm semanal agrupando minors/patches; github-actions mensal) + `dependency-review-action` no PR                                                                                                                                                                                                                                                                                                      | P       | Alto       | Baixo                                                            | Primeiros PRs do Dependabot abertos                               |
| P1-3 | CodeQL (JavaScript/TypeScript), se o plano incluir Code Security                                                                                                                                                                                                                                                                                                                                                               | P       | Médio      | Baixo                                                            | Primeira análise sem alertas críticos                             |
| P1-4 | Headers de segurança em `next.config.ts`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restritiva, `frame-ancestors 'none'`. CSP em `Content-Security-Policy-Report-Only` com os domínios do Mercado Pago, ImageKit e Sentry; depois enforce                                                                                                                    | M       | Alto       | Médio (CSP pode quebrar o Secure Fields): começar em report-only | Headers presentes; nenhuma violação de CSP no checkout em preview |
| P1-5 | `.gitattributes` (`* text=auto eol=lf`) + renormalização + `pnpm format`, em commit isolado                                                                                                                                                                                                                                                                                                                                    | P       | Médio      | Baixo (diff grande, só formatação)                               | `prettier --check .` passa                                        |
| P1-6 | Reprodutibilidade: `engines.node >=24 <25`, `.nvmrc` com `24`, `packageManager` em `pnpm@12.10.1`, `corepack enable` no README                                                                                                                                                                                                                                                                                                 | P       | Médio      | Baixo                                                            | CI e Vercel usam as mesmas versões                                |
| P1-7 | Testes de integração no CI com branch Neon efêmero (o `neon.ts` já define TTL de 7 dias para branches) via secret `TEST_DATABASE_URL` com escopo de environment                                                                                                                                                                                                                                                                | M       | Alto       | Médio (custo e limite do plano Neon)                             | Job `integration` verde; branch destruído ao final                |

### P2 — Modernização

| #    | Ação                                                                                                                                                                      | Esforço | Impacto | Risco                    | Concluído quando                                                           |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------- | ------------------------ | -------------------------------------------------------------------------- |
| P2-1 | Lote de minors/patches da seção D (Next 16.4, React 19.3, Better Auth 1.7.7, Zod 4.6, Inngest 4.22, etc.)                                                                 | P       | Médio   | Baixo                    | CI verde + e2e manual dos fluxos críticos (`docs/critical-flow-matrix.md`) |
| P2-2 | Limpeza de dependências: remover `@neon/env`; mover `shadcn` e `@neon/config` para dev                                                                                    | P       | Baixo   | Baixo                    | `next build` verde; árvore de produção menor                               |
| P2-3 | `tsconfig.json`: remover os includes de `.next-e2e`/`.next-build-check`                                                                                                   | P       | Médio   | Baixo                    | `tsc` verde depois de `next typegen`                                       |
| P2-4 | Playwright no CI (job manual ou noturno, contra banco efêmero), começando pelo `marketplace.spec.ts`                                                                      | M       | Alto    | Médio (tempo, flakiness) | Execução noturna estável por 1 semana                                      |
| P2-5 | Majors em PRs separados, nesta ordem: Sentry 11, Vitest 5, ESLint 10 (quando o `eslint-config-next` suportar). TypeScript 7 e Prisma 8 só depois de estáveis e suportados | M cada  | Médio   | Médio                    | Cada PR com CI verde e nota de migração                                    |
| P2-6 | Avaliar Node 26 após o LTS (28/10/2026) e o suporte do Vercel                                                                                                             | P       | Baixo   | Baixo                    | Decisão registrada no AGENTS.md                                            |

### P3 — Otimizações

| #    | Ação                                                                                                                                                                                           | Esforço | Impacto | Risco  | Concluído quando                          |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------- | ------ | ----------------------------------------- |
| P3-1 | `SECURITY.md` (contato e escopo), `CONTRIBUTING.md` (setup, `corepack`, scripts, convenção de commits, regra "migrations sempre versionadas"), template de PR com o checklist do AGENTS.md §64 | P       | Médio   | Nenhum | Arquivos no repo                          |
| P3-2 | `CODEOWNERS` (domínios financeiros `payments/`, `checkout/` e `prisma/` exigem seu review)                                                                                                     | P       | Médio   | Nenhum | Regra ativa junto com a branch protection |
| P3-3 | Templates de issue (bug, decisão de negócio)                                                                                                                                                   | P       | Baixo   | Nenhum | —                                         |
| P3-4 | Commitlint ou verificação de título de PR (opcional)                                                                                                                                           | P       | Baixo   | Baixo  | —                                         |
| P3-5 | README enxuto (setup + links) e "Fases" movidas para `CHANGELOG.md`; corrigir a menção a R2                                                                                                    | P       | Baixo   | Nenhum | —                                         |
| P3-6 | Resolver o `.agents/` e o `skills-lock.json` (versionar de propósito ou remover do índice)                                                                                                     | P       | Baixo   | Nenhum | `.gitignore` coerente com o índice        |
| P3-7 | Limpar diretórios locais `.next-*`, `tmp/`, `playwright-report/`, `test-results/` (já ignorados; só espaço em disco)                                                                           | P       | Baixo   | Nenhum | —                                         |

Fora do escopo, de propósito: Docker/Kubernetes, CD próprio, release semântico, plataforma de feature flags e ferramenta de cobertura obrigatória. Nenhum deles resolve um problema real do projeto hoje (AGENTS.md §54–56, §62).

---

## G. Checklist final

**P0**

- [ ] Commitar e fazer push do trabalho pendente, com as 2 migrations e o `schema.prisma` primeiro
- [ ] Abrir PR `codex/moto-shop-readiness` → `main`
- [ ] `sharp` 0.35.5
- [ ] Override `proxy-addr` ^2.0.8
- [ ] Ativar secret scanning + push protection (painel)
- [ ] Ativar Dependabot alerts e security updates (painel)
- [ ] Proteger `main`: PR obrigatório, sem force-push, sem exclusão (painel)

**P1**

- [ ] `.github/workflows/ci.yml` (typecheck, lint, format, unit, build), com `permissions` mínimas, `concurrency` e actions fixadas por SHA
- [ ] Marcar o CI como check obrigatório na `main`
- [ ] `.github/dependabot.yml` (npm + github-actions)
- [ ] `dependency-review-action` nos PRs
- [ ] CodeQL (se o plano permitir)
- [ ] Headers de segurança e CSP em report-only
- [ ] `.gitattributes` + renormalização + Prettier
- [ ] `engines`, `.nvmrc`, `packageManager` atualizado, Corepack documentado
- [ ] Job de integração com branch Neon efêmero

**P2**

- [ ] Lote de minors/patches
- [ ] Remover `@neon/env`; mover `shadcn` e `@neon/config` para dev
- [ ] Limpar o `include` do `tsconfig`
- [ ] Playwright agendado no CI
- [ ] Majors em PRs separados (Sentry → Vitest → ESLint)

**P3**

- [ ] `SECURITY.md`, `CONTRIBUTING.md`, template de PR, CODEOWNERS, templates de issue
- [ ] README enxuto + `CHANGELOG.md`
- [ ] Decisão sobre `.agents/` e `skills-lock.json`

---

### Limitações desta auditoria

- As configurações administrativas do GitHub e do Vercel não puderam ser lidas (repositório privado, sem `gh` autenticado).
- Testes de integração e Playwright não foram executados: precisam de banco e servidor dedicados.
- Os advisories vêm do banco do npm em 07/10/2026 e precisam ser reavaliados a cada atualização.
- As recomendações sobre majors (Sentry 11, ESLint 10, Vitest 5, TypeScript 7) indicam que existe nova versão; os guias de migração devem ser lidos no PR de cada uma.

---

## Status da execução — 08/10/2026

Executado na branch `chore/repo-hardening` (PR empilhado sobre `codex/moto-shop-readiness`), um commit por assunto. Validação final: `pnpm typecheck` 0 erros, `eslint .` limpo, `prettier --check .` limpo, Vitest 138 arquivos / 762 testes, `next build` concluído **sem banco** (simulando o CI), páginas principais respondendo 200 no dev server.

| Ação                                          | Status                 | Observação                                                                                                                                                                           |
| --------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P0-1 Versionar trabalho pendente              | Feito                  | Feito na branch `codex/moto-shop-readiness` (31 migrations versionadas)                                                                                                              |
| P0-2 `sharp` 0.35.5 + overrides               | Feito                  | Também `source-map-js` ^1.2.2. `braces` 3.0.3 segue sem versão corrigida publicada (só build, via fast-glob)                                                                         |
| P0-3 Proteções no painel do GitHub            | Pendente (responsável) | Exige acesso de administrador (ver checklist abaixo)                                                                                                                                 |
| P1-1 CI                                       | Feito                  | `.github/workflows/ci.yml`; actions fixadas por SHA; build sem banco (sitemap passou a ser dinâmico)                                                                                 |
| P1-2 Dependabot + dependency review           | Feito                  | `dependabot.yml` (npm semanal agrupado, actions mensal) e `pull-request.yml`                                                                                                         |
| P1-3 CodeQL                                   | Feito                  | `codeql.yml`; em repositório privado requer GitHub Code Security                                                                                                                     |
| P1-4 Headers de segurança                     | Feito                  | `src/config/security-headers.ts`; CSP em report-only até homologar o Secure Fields                                                                                                   |
| P1-5 `.gitattributes` + Prettier              | Feito                  | LF obrigatório; repositório formatado num commit isolado                                                                                                                             |
| P1-6 Versões fixadas                          | Feito                  | `engines` (Node 24), `.nvmrc`, `packageManager` pnpm 12.10.1                                                                                                                         |
| P1-7 Integração no CI                         | Feito                  | Job condicionado aos secrets `TEST_DATABASE_URL`/`TEST_DATABASE_DIRECT_URL` (branch Neon descartável)                                                                                |
| P2-1 Minors/patches                           | Feito                  | Next 16.4, React 19.3, Better Auth 1.7.7, Zod 4.6, Inngest 4.22, cn 0.4 e outros. Playwright mantido em 1.63: 1.64 violava a política de idade mínima de release                     |
| P2-2 Limpeza de dependências                  | Feito                  | `@neon/env` removido; `shadcn` e `@neon/config` em devDependencies                                                                                                                   |
| P2-3 `tsconfig`                               | Feito                  | Includes de builds antigos removidos; `typecheck` roda `next typegen` antes                                                                                                          |
| P2-4 Playwright no CI                         | Feito                  | `e2e.yml` noturno/manual, condicionado aos mesmos secrets                                                                                                                            |
| P2-5 Majors                                   | Parcial                | Sentry 11 e Vitest 5 atualizados. **Adiados de propósito:** ESLint 10 (plugins react/import/jsx-a11y sem suporte declarado), TypeScript 7 e Prisma 8 (RC) — registrados no AGENTS.md |
| P2-6 Node 26                                  | Decidido               | Manter Node 24; reavaliar após o LTS do 26 (28/10/2026) e suporte do Vercel                                                                                                          |
| P3-1 SECURITY / CONTRIBUTING / template de PR | Feito                  | Prazos de resposta do SECURITY.md são sugestão — confirmar com o responsável                                                                                                         |
| P3-2 CODEOWNERS                               | Feito                  | `@HanielCota` em todo o repo e nos caminhos críticos                                                                                                                                 |
| P3-3 Templates de issue                       | Feito                  | Bug e decisão de produto (formulários)                                                                                                                                               |
| P3-4 Conventional Commits                     | Feito                  | Verificação do título do PR em `pull-request.yml`                                                                                                                                    |
| P3-5 README + CHANGELOG                       | Feito                  | README enxuto; histórico das fases em `CHANGELOG.md`                                                                                                                                 |
| P3-6 `.agents/` e `skills-lock.json`          | Feito                  | Removidos do índice e adicionados ao `.gitignore`: são ferramentas de agente instaladas por máquina, não código do projeto (cópias locais preservadas)                               |
| P3-7 Limpeza local                            | Feito                  | ~3 GB de builds antigos removidos (`.next-*`, relatórios de teste e cache do Turbopack). `tmp/` preservado                                                                           |

### Checklist que depende do responsável (painel do GitHub)

- [ ] Settings → Rules: proteger `main` (PR obrigatório, 1 aprovação, sem force-push/exclusão, checks obrigatórios: `Typecheck, lint, format, unit tests and build`, `Dependency review`, `Conventional Commits title`).
- [ ] Settings → Code security: secret scanning + push protection, Dependabot alerts e security updates; Code Security para o CodeQL (ou desativar o workflow).
- [ ] Settings → Secrets and variables → Actions: `TEST_DATABASE_URL` e `TEST_DATABASE_DIRECT_URL` de um branch Neon descartável, para ligar integração e E2E.
- [ ] Settings → Code security: ativar "Private vulnerability reporting" (referenciado no SECURITY.md).
