# Guia de telas — O Moto Shop

Roteiro para revisar todas as telas com dados de demonstração. Tudo o que aparece com **"· demonstração"** ou **"(demonstração)"** é fictício: lojas, produtos, preços e pedidos foram criados só para esta revisão e não podem ser comprados.

> O pagamento real está **bloqueado de propósito** (o Mercado Pago ainda não liberou a divisão de pagamento entre lojistas). Por isso o checkout mostra um aviso e não cria pedidos. Isso é esperado, não é erro.

---

## 1. Como abrir

1. No `.env.local`, deixe `BETTER_AUTH_URL="http://localhost:3001"` e inclua `review.admin@example.test` em `ADMIN_EMAILS` (separado por vírgula). Sem isso, o login falha na porta 3001 e o Admin fica bloqueado.

2. Na pasta do projeto, crie os dados de demonstração (pode rodar quantas vezes quiser; não duplica nada):

   ```bash
   pnpm db:seed:review
   ```

3. Suba o servidor:

   ```bash
   pnpm dev:review
   ```

   Sem `pnpm` no PATH, use `node node_modules/tsx/dist/cli.mjs scripts/seed-review-data.ts` e `node node_modules/next/dist/bin/next dev --hostname localhost --port 3001`.

4. Abra **http://localhost:3001**.

5. Para apagar todos os dados de demonstração ao final da revisão:

   ```bash
   pnpm db:remove:review
   ```

## 2. Contas de demonstração

Todas usam a mesma senha: o valor de `REVIEW_ACCOUNTS_PASSWORD`, no início de `scripts/seed-review-data.ts`. Entre em **/login**. Para trocar de conta, use **Sair** no menu do ícone de usuário (loja) ou no topo da Central do Lojista/Admin.

| Perfil | E-mail | O que mostra |
|---|---|---|
| Cliente | `review.cliente@example.test` | Pedidos em todas as etapas, favoritos, motos, endereços, carrinho com duas lojas |
| Lojista (dono) | `review.lojista@example.test` | Central do Lojista completa da loja **Garagem MX** |
| Lojista (equipe de catálogo) | `review.catalogo@example.test` | A mesma loja com permissões limitadas (só catálogo) |
| Lojista pendente | `review.pendente@example.test` | Loja aguardando aprovação |
| Lojista (segunda loja) | `review.lojista2@example.test` | Loja **Box 77**, com comissão própria de 10% |
| Admin | `review.admin@example.test` | Painel administrativo (exige o passo 1 acima) |

**Pedido de convidado** (sem conta): o seed imprime no final um link `http://localhost:3001/orders/MS-REVIEW-0008?accessToken=…`. Abra-o numa janela anônima para ver o acompanhamento sem login. O token muda a cada execução do seed.

---

## 3. Loja (sem entrar na conta)

Revise cada tela no **celular** (no Chrome: F12 → ícone de celular → iPhone/Pixel) e no desktop. O projeto é pensado primeiro para o celular.

| Tela | Endereço | O que observar |
|---|---|---|
| Home | `/` | Busca "Minha Moto" (fabricante → modelo → ano), categorias, produtos em destaque, rodapé |
| Catálogo | `/products` | Filtros (no celular, em "Filtrar produtos"), chips de filtro ativo, ordenação, paginação |
| Busca | `/products?q=capacete` | Resultado da busca e estado vazio (`/products?q=xyz`) |
| Produto | `/products/review-capacete-apex-pro` (ou clique em qualquer card) | Galeria, variações, preço/promoção, aviso de compatibilidade com a moto, frete por CEP, perguntas e avaliações. No celular, a barra fixa "Adicionar" aparece ao rolar |
| Loja | `/loja/review-garagem-mx` e `/loja/review-box-77` | Vitrine com selo VIP (Garagem MX), filtros, produtos e avaliações da loja |
| Categoria | `/categoria/<slug>` (pela home ou pelo produto) | Página de categoria |
| Marca | `/marca/<slug>` (link da marca no produto) | Página de marca |
| Moto | `/moto/<fabricante>/<modelo>/<ano>` (pela busca "Minha Moto") | Peças compatíveis com a moto |
| Carrinho | `/cart` | Itens agrupados por loja, subtotal por loja, aviso de pagamento indisponível, barra fixa no celular |
| Checkout | `/checkout` | Formulário (CEP preenche o endereço), cotação de frete, aviso de pagamento indisponível |
| Prévias visuais | `/cart?preview=1` e `/checkout?preview=1` | Carrinho e checkout com produtos de exemplo, sem precisar de conta |
| Login / cadastro | `/login` e `/login?modo=cadastro` | Erros por campo, botão de mostrar senha |
| Esqueci a senha | `/forgot-password` | Recuperação de acesso |
| Página inexistente | `/qualquer-coisa` | Tela de "não encontrado" |

## 4. Área do cliente (`review.cliente@example.test`)

| Tela | Endereço | O que observar |
|---|---|---|
| Meus pedidos | `/orders` | Lista com status, filtros e busca |
| Detalhe do pedido | `/orders/<número>` (clique em um pedido) | Linha do tempo, rastreio, pagamento. Conforme a etapa: pedir cancelamento (pago), devolução e avaliação (entregue), disputa |
| Favoritos | `/favorites` | Produtos salvos, remover favorito |
| Minhas motos | `/account/motorcycles` | Garagem com moto principal |
| Endereços | `/account/addresses` | Endereço padrão, adicionar e remover |
| Notificações | `/account/notifications` | Preferências de e-mail |

Pedidos de demonstração (`/orders/MS-REVIEW-000X`):

| Pedido | Situação | O que dá para ver |
|---|---|---|
| MS-REVIEW-0001 | Aguardando pagamento | Reconsulta de pagamento, estoque reservado |
| MS-REVIEW-0002 | Pago | Solicitação de cancelamento já aberta |
| MS-REVIEW-0003 | Em separação | Pedido em preparação pela loja |
| MS-REVIEW-0004 | Enviado | Código de rastreio e disputa aberta |
| MS-REVIEW-0005 | Entregue | Devolução solicitada, avaliações do produto e da loja |
| MS-REVIEW-0006 | Cancelado | Pedido encerrado |
| MS-REVIEW-0007 | Duas lojas, parcialmente enviado | Um pedido dividido por loja, com cupom do marketplace |
| MS-REVIEW-0008 | Convidado | Só pelo link do seed (ver seção 2) |

Os produtos de demonstração não passam pelo checkout, e os pagamentos são fictícios. "Reconsultar pagamento" e "Reprocessar webhook" podem mostrar erro do Mercado Pago sem alterar nada.

## 5. Central do Lojista (`review.lojista@example.test`)

| Tela | Endereço | O que observar |
|---|---|---|
| Visão geral | `/seller` | Indicadores, alertas de estoque, próximos passos |
| Pedidos | `/seller/orders` | Pedidos por status, filtros, ações de envio (marcar como enviado/entregue) |
| Produtos | `/seller/products` | Produtos em todos os status: rascunho, em análise, rejeitado (com motivo), aprovado e arquivado. Ajuste de estoque |
| Novo produto | `/seller/products/new` | Formulário com erro por campo e slug automático. Ao salvar, vai direto para a edição |
| Editar produto | "Editar" em um rascunho | Fotos, status, motivo da rejeição, "Enviar para aprovação" |
| Perguntas | `/seller/questions` | Perguntas respondidas e pendentes |
| Frete | `/seller/shipping` | Modalidades de frete próprio (ativa e inativa) |
| Integrações | `/seller/shipping/integrations` | Conexão com o Melhor Envio |
| Cupons | `/seller/coupons` | Cupom ativo e cupom futuro |
| Configurações | `/seller/settings` | Perfil da loja, logo/banner, redes sociais, equipe |

Compare com `review.catalogo@example.test`: o menu mostra só o que a função de catálogo permite.

Com `review.pendente@example.test`, a Central mostra a loja aguardando aprovação.

## 6. Admin (`review.admin@example.test`)

| Tela | Endereço | O que observar |
|---|---|---|
| Painel | `/admin` | Contadores de pendências e saúde das integrações |
| Lojistas | `/admin/sellers` | Aprovar a loja pendente, suspender e reativar |
| Produtos | `/admin/products` | Moderação do produto em análise (aprovar/rejeitar) |
| Catálogo | `/admin/catalog` | Categorias, marcas, fabricantes, modelos e motos |
| Cupons | `/admin/coupons` | Cupons do marketplace |
| Plano VIP | `/admin/vip` | Assinaturas das lojas |
| Comissão | `/admin/commission` | Comissão padrão e por loja |
| Pedidos | `/admin/orders` | Monitor de pedidos por loja |
| Cancelamentos | `/admin/cancellations` | Solicitação de cancelamento pendente |
| Devoluções | `/admin/returns` | Devolução pendente |
| Disputas | `/admin/disputes` | Disputa aberta |
| Moderação | `/admin/moderation` | Ocultar e restaurar perguntas e avaliações |
| Etiquetas | `/admin/shipping-recovery` | Conferência de etiquetas |
| Integrações | `/admin/integrations` | Quais serviços externos estão configurados |
| Webhooks | `/admin/webhooks` | Evento com falha e "Reprocessar" |
| E-mails | `/admin/emails` | Entrega com falha e "Reenviar" |
| Auditoria | `/admin/audit` | Histórico de ações administrativas |
| Eventos pendentes | `/admin/outbox` | Eventos que exigem atenção |

---

## 7. Como dar feedback

Para cada observação, anote:

1. **Tela** (endereço da barra do navegador).
2. **Aparelho**: celular ou desktop.
3. **O que viu** e **o que esperava**. Um print ajuda muito.
4. **Prioridade**: impede o uso / incomoda / detalhe.

Pontos que precisam de decisão do dono do produto (registrados em `docs/auditoria-2026-10.md`):

- Link de WhatsApp na vitrine da loja: manter, remover ou restringir?
- Códigos de cupom: o lojista pode usar qualquer código ou alguns ficam reservados ao marketplace?
- Quem aprova o merge para a `main` e o deploy.
