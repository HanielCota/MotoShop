# Validação do MVP — 23/09/2026

## Quatro frentes concluídas nesta rodada

1. **Jornada do lojista:** testes de navegador cobrem criação de conta, solicitação de loja, bloqueio antes da aprovação, aprovação administrativa, criação de produto com preço em reais/estoque/compatibilidade, rascunho fora do catálogo, submissão, aprovação e publicação.
2. **Catálogo e experiência:** busca, Minha Moto, filtros em reais, ordenação e paginação no PostgreSQL; preços/estoque consideram todas as variantes ativas. Filtros secundários recolhíveis, navegação por teclado, estado vazio e checagem de largura no computador e celular. Título principal da página de produto e contagem de avaliações corrigidos.
3. **Compra com serviços simulados:** testes usam banco de desenvolvimento e provider de pagamento injetado apenas no processo de teste. Verificam duas lojas, cálculo em centavos, comissão, financiamento de cupons, estoque, concorrência, idempotência, acesso guest, recusa, timeout incerto e autorização sem captura. Nenhuma cobrança real foi feita.
4. **Frete próprio:** `/seller/shipping` permite cadastrar faixa de CEP, preço fixo por pedido da loja e prazo em dias úteis. Ativação explícita, permissões, auditoria, cotação e revalidação no checkout. O lojista pode consultar itens/endereço e confirmar envio/entrega em `/seller/orders`; sem compra de etiqueta externa. Alterar regra significa criar outra modalidade e desativar a anterior, preservando snapshots de pedidos.

## Correções encontradas na revisão

- O cupom preenchido não chegava à aplicação de checkout.
- A criação aninhada de itens enviava `sellerId` indevidamente e falhava no Prisma.
- Descontos de cupons usavam campos exclusivos de subsídio de frete, violando as restrições financeiras do banco. Agora há snapshots separados para quem financia o desconto.
- Movimentação de venda gravava quantidade zero, incompatível com a restrição de auditoria. Reserva e venda agora usam o identificador correto do pedido.
- Uma tentativa simultânea poderia converter o mesmo carrinho novamente; a conversão passou a ser condicional e transacional.
- Retry guest perdia o token e a consulta de idempotência não verificava propriedade. O token derivado fica vinculado à identidade do carrinho e a consulta valida o proprietário.
- Recusa definitiva não liberava reservas; timeout incerto as liberava indevidamente. Agora recusa cancela/libera e timeout mantém pendência para reconciliação.
- Eventos repetidos de pagamento podiam regredir pedidos já enviados/entregues. Reconciliação e finalização serializam por pedido e não repetem baixa de estoque.
- Autorização sem captura era tratada como pagamento confirmado. Somente `APPROVED` confirma a venda.
- A flag multi-seller habilitava uma capacidade que o adapter Mercado Pago ainda não implementa. A integração real permanece bloqueada para mais de uma loja.
- Painel carregava dados de seções sem permissão mesmo quando ocultas. As consultas passaram a respeitar as permissões da seção.
- Filtro de preço e disponibilidade de cards consideravam apenas a primeira variante; ordenação pública também foi corrigida.
- Ordenação de perguntas ignorava o parâmetro escolhido; a contagem de avaliações mostrava apenas a página carregada.
- Destino pós-login passou a aceitar apenas caminho interno seguro.

## Evidências e reprodução

- `pnpm test`: 69 testes em 22 arquivos.
- `pnpm test:integration`: 11 testes; precisa do banco de desenvolvimento configurado em `.env.local`, referências semeadas e migrações aplicadas.
- `pnpm test:e2e`: 4 testes, com jornadas em Chromium desktop e Pixel 7; requer Chromium do Playwright instalado.
- `pnpm typecheck`, `pnpm lint` e `pnpm build`: verificação de tipos, lint e compilação de produção.
- Capturas locais de catálogo, produto e frete próprio ficam em `test-results/`; relatório em `playwright-report/`. As capturas de celular foram inspecionadas visualmente.
- Migrações `20260923100000_own_shipping` e `20260923110000_discount_funding` aplicadas ao banco de desenvolvimento disponível.
- Testes usam contas e lojas temporárias identificadas por execução e removem apenas os próprios registros. O admin temporário é configurado no processo do servidor E2E; `.env.local` não é alterado. Não executar essas suítes contra banco de produção.

## Limites que permanecem para lançamento

Esta rodada não equivale a homologação de operação financeira real. Mercado Pago (credenciais sandbox, webhooks e modalidade de split/repasse), Melhor Envio, R2, e-mails e workflows precisam de configuração e testes com seus serviços. Não foram compradas etiquetas nem enviados e-mails reais.

Pagamento com resultado incerto permanece pendente para reconciliação; recuperação automática de cobranças sem `externalId`, políticas de expiração e homologação de retries devem ser validadas junto ao gateway antes de abrir vendas reais.

Uploads de fotos não foram realizados sem R2. A aprovação atual permite produto sem foto e apresenta fallback; os testes verificam os controles de associação/ownership já existentes. A vitrine ilustrativa da landing permanece identificada como demonstração e não foi inserida no catálogo.

Mobile validado em emulação Chromium, não em aparelhos físicos/Safari. A verificação de acessibilidade incluiu nomes de controles, teclado, títulos e ausência de rolagem horizontal nos fluxos testados; não é uma certificação completa de acessibilidade.
