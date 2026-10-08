# O Moto Shop — checklist até a abertura pública

Este arquivo acompanha tarefas curtas de lançamento. O [AGENTS.md](../AGENTS.md) define produto e arquitetura; [production-readiness.md](production-readiness.md) guarda evidências detalhadas e bloqueadores. Uma tela ou endpoint existente não basta para marcar uma tarefa como validada.

## Como usar

- Execute uma tarefa por vez, citando seu ID no pedido. Confira antes o estado do Git e as evidências já registradas.
- Marque `[x]` somente após cumprir o critério de aceite e registrar abaixo da tarefa a data, a revisão/ambiente e a verificação executada. Use `Pendente`, `Em andamento` ou `Bloqueada` enquanto faltar prova.
- Ao encontrar dependência externa, registre o dado ou acesso exato necessário e avance apenas nas tarefas independentes. Não repita uma tentativa sem hipótese nova; interrompa se houver sinal de loop.
- Preserve mudanças preexistentes e segredos. Sem cobrança, compra de etiqueta, pagamento real, deploy de produção ou mudança de plano sem autorização correspondente.
- Mudanças em permissões, dinheiro e produção exigem revisão independente antes do aceite. Testes relevantes, typecheck, lint e build são portas de qualidade conforme o risco da alteração.

## Marco 1 — Versão candidata do código

Meta: uma revisão identificável, sem defeitos críticos conhecidos nos fluxos cobertos, pronta para Preview.

- [x] **T01 — Inventariar o trabalho local.** Estado: Validada em 05/10/2026. Evidência: [inventário da versão candidata](release-inventory.md), `git status --short`, `git check-ignore -v`, varredura de padrões de segredo nos arquivos alterados/novos e `git diff --check`. Todos os arquivos foram classificados; artefatos locais foram preservados e excluídos de Git/Vercel. A varredura não detectou segredos nos arquivos candidatos, sem prometer cobertura absoluta.
- [x] **T02 — Diagnosticar a execução E2E interrompida.** Estado: Validada em 05/10/2026 no Neon de teste. A hipótese nova era que a ausência de resultado por um minuto não significava travamento: o runner tem timeout de 180 s por teste. Deixada concluir, a suíte passou 8/8 em 5,7 min (Chromium desktop e mobile). `NODE_OPTIONS=--trace-warnings` localizou o aviso Gzip no runtime compilado de desenvolvimento do Next.js 16.3.8 (`next/dist/compiled/compression` e `app-page-turbo.runtime.dev`), sem frame de código da aplicação; não prova ausência de vazamento no framework. Houve um panic transitório do Turbopack no servidor de desenvolvimento, que não impediu a execução; registrar e reavaliar se voltar a ocorrer. Os providers financeiros e de frete estavam desativados/simulados, sem cobrança ou deploy.
- [ ] **T03 — Fechar lacunas de autorização.** Estado: Em andamento em 07/10/2026. As ações de cupons, perfil da loja, perguntas, cadastro concorrente de membros e catálogo Admin foram reforçadas, com testes de negação e concorrência. A varredura desta rodada conferiu as ações de lojista, produto, catálogo, cupons, perguntas, webhook, aprovação de seller e comissão; não encontrou uma nova quebra de isolamento nesse conjunto. A comissão padrão agora rejeita entrada vazia e registra o valor anterior na mesma transação serializável, com teste. Ainda faltam revisão completa das demais ações e revisão independente antes do aceite.
- [ ] **T04 — Fechar lacunas das regras críticas.** Estado: Em andamento em 07/10/2026. A [matriz de cenários críticos](critical-flow-matrix.md) enumera provas e lacunas. A suíte de integração passou 26/26 no Neon de teste autorizado, com providers desativados/simulados; inclui carrinho multi-seller, centavos, estoque concorrente, cupons, recusa/timeout, webhook repetido, cancelamento parcial e devolução/reembolso. A suíte unitária completa passou 468/468 em 93 arquivos. Falta revisão independente; o resultado não homologa Mercado Pago ou Melhor Envio.
- [ ] **T05 — Revisar fluxos e interface.** Estado: Em andamento em 07/10/2026. O Admin foi separado em painel e 17 áreas, cada uma com rota própria; menu mobile e revalidação de dados foram conferidos no navegador. Uma rolagem horizontal compartilhada nas páginas da conta foi corrigida e coberta por E2E. A [matriz de 45 rotas](manual-route-matrix.md) distingue inspeção, interação, E2E e pendências. As 17 áreas do Admin foram abertas a 390 px sem erro nem overflow. A suíte E2E do fluxo principal de lojista, cliente e moto passou em desktop/mobile após alinhar os testes aos rótulos atuais; não houve envio de pagamento. Ainda faltam operações manuais completas para cada perfil e estado, inclusive cliente comum e aparelho físico. Aceite: inventário de rotas e funções percorrido para visitante, cliente, lojista e Admin em desktop/mobile; sucesso, validação, vazio e erro registrados como aprovados, reprovados ou bloqueados.
- [ ] **T06 — Fechar a revisão candidata.** Estado: Em andamento em 07/10/2026. Typecheck, lint, 468 testes unitários, 26 testes de integração, build e validação do Prisma passaram nesta rodada; 31 migrations estão em dia no Neon de teste. Ainda é necessário concluir o E2E completo na revisão final, registrar commits coerentes e fechar T03–T05 para aceitar a candidata. Aceite: alterações aceitas em commits coerentes com revisão identificada; typecheck, lint, testes relevantes e build aprovados nessa revisão; limitações publicadas no quadro de prontidão.

## Marco 2 — Preview atualizado

Meta: o endereço de Preview serve exatamente a revisão T06 e seus fluxos principais foram verificados nele.

- [ ] **T07 — Liberar publicação no projeto Vercel correto.** Estado: Bloqueada: falta permissão do autor Git para criar deployments ou publicação por identidade já autorizada. Aceite: um deploy de Preview pode ser criado no projeto correto sem contornar a proteção da conta.
- [ ] **T08 — Conferir configuração de Preview.** Estado: Pendente. Aceite: banco de teste, autenticação, URLs e integrações de sandbox revisados no escopo Moto Shop; segredos não aparecem no Git nem no navegador.
- [ ] **T09 — Publicar T06 em Preview.** Estado: Bloqueada por T07. Aceite: URL de Preview aponta para o deployment da revisão identificada em T06, com build concluído e sem alterar Production.
- [ ] **T10 — Validar o Preview.** Estado: Pendente. Aceite: login, cadastro/aprovação de loja, produto, catálogo, carrinho e áreas protegidas percorridos no endereço publicado; resultados e limites anotados, sem pagamento real.

## Marco 3 — Divulgação sem vendas abertas

Meta: endereço público com conteúdo aprovado e sem prometer compra indisponível.

- [ ] **T11 — Aprovar marca e conteúdo público.** Estado: Pendente. Aceite: responsável aprovou textos, imagens, contato e mensagens comerciais exibidas na versão de divulgação.
- [ ] **T12 — Revisar dados de demonstração.** Estado: Pendente. Aceite: itens, imagens, perguntas e lojas de teste foram removidos ou claramente identificados; produtos `isDemo` permanecem impedidos de entrar no carrinho/checkout no servidor, conforme AGENTS.md.
- [ ] **T13 — Ajustar a experiência antes das vendas.** Estado: Pendente. Aceite: ações e mensagens públicas descrevem corretamente o que está disponível; nenhum caminho oferece concluir uma compra indisponível.
- [ ] **T14 — Aprovar a divulgação.** Estado: Pendente. Aceite: navegação, formulários e conteúdo público conferidos em desktop/mobile no endereço final; responsável autoriza divulgação.

## Marco 4 — Estrutura definitiva

Meta: produção isolada dos testes, recuperável e monitorada.

- [ ] **T15 — Configurar Neon oficial.** Estado: Bloqueada: falta banco definitivo. Aceite: conexões de produção corretas, separadas do Neon de teste, configuradas sem semear conteúdo mock.
- [ ] **T16 — Ensaiar migração e recuperação.** Estado: Pendente. Aceite: migrations ensaiadas, backup e restauração verificados e procedimento de rollback documentado antes da primeira migração oficial.
- [ ] **T17 — Validar ImageKit definitivo.** Estado: Bloqueada: faltam credenciais do serviço aprovado. Aceite: upload direto, limites, associação server-side, exibição e exclusão verificados no ambiente adequado, sem plano com cobrança excedente não autorizada.
- [ ] **T18 — Validar Resend e Inngest.** Estado: Pendente. Aceite: remetente/domínio final e e-mails transacionais confirmados; workflows, falhas e retries críticos verificados no ambiente autorizado.
- [ ] **T19 — Fechar domínio, autenticação e observabilidade.** Estado: Pendente. Aceite: URL canônica, callbacks, sessões, logs sem dados sensíveis, monitoramento e alertas verificados; revisão independente de segurança concluída.

## Marco 5 — Pagamento e frete homologados

Meta: checkout multi-lojista demonstrado integralmente no sandbox antes de aceitar dinheiro real.

- [ ] **T20 — Definir a modalidade Mercado Pago.** Estado: Bloqueada: falta confirmação da capacidade habilitada para a conta do marketplace. Aceite: modalidade, limites de split e responsabilidades de repasse documentados pelo responsável/provedor; nenhuma implementação presume split 1:N.
- [ ] **T21 — Conectar lojistas de teste.** Estado: Pendente. Aceite: autorização exigida pela modalidade T20 concluída com contas de sandbox, tokens protegidos e escopo por seller confirmado.
- [ ] **T22 — Homologar pagamento individual.** Estado: Pendente. Aceite: aprovado, recusado, pendente e webhook repetido produzem estados corretos de pedido/estoque; confirmação é server-side e há revisão independente.
- [ ] **T23 — Homologar compra multi-lojista.** Estado: Pendente. Aceite: checkout único, SellerOrders, comissão, frete por seller, falhas, cancelamento parcial e refund simulado reconciliados em sandbox; revisão independente financeira concluída.
- [ ] **T24 — Homologar frete.** Estado: Pendente. Aceite: seller autorizado no Melhor Envio sandbox obtém cotação e acompanha envio; frete próprio também funciona. Compra de etiqueta com custo requer autorização específica.

## Marco 6 — Operação e abertura

Meta: primeira venda real controlada e, após avaliação, abertura pública de compras.

- [ ] **T25 — Preparar catálogo e regras operacionais.** Estado: Pendente. Aceite: produtos, imagens autorizadas, preços, variantes e estoque reais aprovados; comissão, frete, descontos, cancelamento, devolução e disputa definidos pelo responsável.
- [ ] **T26 — Publicar produção e executar piloto restrito.** Estado: Pendente. Aceite: migrations e deploy autorizados, smoke tests aprovados, primeira operação real autorizada e acompanhada com suporte/monitoramento; revisão independente concluída.
- [ ] **T27 — Abrir compras ao público.** Estado: Pendente. Aceite: resultados do piloto avaliados, incidentes críticos corrigidos, operação capaz de atender pedidos e autorização explícita para abertura e divulgação de vendas.

## Próxima tarefa

**T03.** Revisar ações de lojista e Admin no servidor, reforçar testes de negação e isolamento entre lojas e obter revisão independente antes do aceite.
