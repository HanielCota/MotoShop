# Guia de telas — O Moto Shop

Roteiro para revisar todas as telas com dados de demonstração. Tudo o que aparece com **"· demonstração"** ou **"(demonstração)"** é fictício: lojas, produtos, preços e pedidos foram criados só para esta revisão. A compra desses produtos é simulada: o checkout mostra "Compra concluída", mas nada é gravado (nenhum pedido, pagamento ou e-mail).

> O pagamento real está **bloqueado de propósito** (o Mercado Pago ainda não liberou a divisão de pagamento entre lojistas). Por isso, com produtos reais no carrinho, o checkout mostra um aviso e não cria pedidos; esse comportamento é esperado.

---

## 1. Como abrir

> **Atenção: o banco do `.env.local` é o mesmo do site em produção (motoshopbrasil.com.br).** Sem `REVIEW_PUBLISH_STORES=true`, as lojas de demonstração ficam **`PENDING`**: invisíveis na vitrine e sem acesso à Central do Lojista. Até o lançamento, o responsável pelo projeto decidiu publicar os dados de demonstração nesse banco para a revisão do cliente; depois, remova tudo com `pnpm db:remove:review` (passo 5). Se preferir não expor nada, use um banco isolado (passo 0).

0. **Banco isolado para a revisão (recomendado).** No console da Neon, crie um branch a partir do principal (por exemplo, `review`) e copie a connection string dele. Use essa URL em `DATABASE_URL` e `DIRECT_URL` só enquanto durar a revisão: nada do que acontecer ali afeta o site. Apague o branch ao final.

1. No `.env.local`, deixe `BETTER_AUTH_URL="http://localhost:3001"` e inclua `review.admin@example.test` em `ADMIN_EMAILS` (separado por vírgula). Sem isso, o login falha na porta 3001 e o Admin fica bloqueado. Defina também `REVIEW_ACCOUNTS_PASSWORD` com a senha das contas de demonstração (veja a seção 2) e, se o banco não for local, ponha o host dele em `SCRIPT_DATABASE_HOSTS`: sem isso, o seed e a remoção recusam rodar (proteção contra rodar no banco errado). Só o host vai nessa variável, nunca a URL com senha.

2. Na pasta do projeto, crie os dados de demonstração (pode rodar quantas vezes quiser; não duplica nada). Publique as lojas de demonstração com a variável `REVIEW_PUBLISH_STORES`:

   ```bash
   REVIEW_PUBLISH_STORES=true \
   REVIEW_VIEWER_CUSTOMER_EMAILS="<e-mail da conta de cliente>" \
   REVIEW_VIEWER_SELLER_EMAILS="<e-mail da conta de lojista>" \
   pnpm db:seed:review
   ```

   - `REVIEW_PUBLISH_STORES=true` deixa as lojas aprovadas/ativas visíveis. Sem a variável, elas ficam `PENDING`.
   - `REVIEW_VIEWER_CUSTOMER_EMAILS` (opcional, separado por vírgula): contas **já existentes** de quem vai revisar. Cada uma recebe um histórico fictício de cliente: 2 endereços "(demonstração)", motos salvas (a principal só se ainda não houver uma), 5 favoritos, carrinho com 3 lojas (só se a conta não tiver carrinho ativo) e 11 pedidos `MS-REVIEW-V<n>-0001…0011` em todas as etapas (aguardando pagamento, pago, em separação, enviado com rastreio, entregue com avaliações, cancelado, multi-loja parcial, devolução, pedido de cancelamento e disputa aberta). Mantenha a mesma ordem dos e-mails nas execuções seguintes.
   - `REVIEW_VIEWER_SELLER_EMAILS` (opcional): contas já existentes adicionadas como **ADMIN** da loja Garagem MX. Se a conta já pertence a outra loja, o vínculo é ignorado (um lojista por conta). O acesso ao Admin continua vindo de `ADMIN_EMAILS`.
   - O seed nunca cria, apaga nem altera e-mail/senha dessas contas. Não coloque e-mails reais neste documento nem no código: use as variáveis.

   Se for preciso esconder as lojas de demonstração rapidamente:

   ```bash
   pnpm db:hide:review
   ```

3. Suba o servidor:

   ```bash
   pnpm dev:review
   ```

   Sem `pnpm` no PATH, use `node node_modules/tsx/dist/cli.mjs scripts/seed-review-data.ts` e `node node_modules/next/dist/bin/next dev --hostname localhost --port 3001`.

4. Abra **http://localhost:3001**.

5. Para apagar todos os dados de demonstração ao final da revisão, confira antes o que seria removido (nada é apagado) e depois rode de verdade:

   ```bash
   pnpm db:remove:review -- --dry-run
   pnpm db:remove:review
   ```

   A remoção apaga as contas `review.*@example.test`, as lojas/produtos/pedidos de demonstração e as imagens `public/images/demo/review-*.webp`. Das contas de visualização, saem apenas o vínculo com a loja de demonstração, os pedidos `MS-REVIEW-V*`, favoritos e itens de carrinho de produtos de demonstração e os endereços/motos/carrinho criados pelo seed; as contas em si continuam intactas.

## 2. Contas de demonstração

Todas usam a mesma senha: o valor da variável `REVIEW_ACCOUNTS_PASSWORD` no `.env.local` de quem rodou o seed (peça a quem administra a demonstração; a senha não fica no código nem nesta documentação). O seed falha se a variável faltar e regrava a senha de todas as contas `review.*` a cada execução. Entre em **/login**. Para trocar de conta, use **Sair** no menu do ícone de usuário (loja) ou no topo da Central do Lojista/Admin.

| Perfil                       | E-mail                                              | O que mostra                                                                                                   |
| ---------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Cliente                      | `review.cliente@example.test`                       | Pedidos em todas as etapas, favoritos, motos, endereços, carrinho com duas lojas                               |
| Lojista (dono)               | `review.lojista@example.test`                       | Central do Lojista completa da loja **Garagem MX**                                                             |
| Lojista (equipe de catálogo) | `review.catalogo@example.test`                      | A mesma loja com permissões limitadas (só catálogo)                                                            |
| Lojista pendente             | `review.pendente@example.test`                      | Loja aguardando aprovação                                                                                      |
| Lojista (segunda loja)       | `review.lojista2@example.test`                      | Loja **Box 77**, com comissão própria de 10%                                                                   |
| Lojistas das demais lojas    | `review.lojista3` … `review.lojista6@example.test`  | **Trilha Forte** (VIP), **Racing Sul** (comissão de 8%, VIP expirado), **Areia Motos**, **Cross Center** (VIP) |
| Lojistas da fila de sellers  | `review.lojista7` … `review.lojista9@example.test`  | Cadastro pendente, loja suspensa e cadastro recusado                                                           |
| Clientes extras              | `review.cliente2` … `review.cliente13@example.test` | Autores das avaliações e perguntas; cada um tem 5–6 pedidos                                                    |
| Admin                        | `review.admin@example.test`                         | Painel administrativo (exige o passo 1 acima)                                                                  |
| Contas de visualização       | definidas por `REVIEW_VIEWER_*_EMAILS`              | Histórico de cliente próprio e/ou acesso à Garagem MX como ADMIN                                               |

**Volume de dados** (para conferir paginação, filtros e indicadores): 6 lojas publicadas + 2 pendentes + 1 suspensa + 1 recusada; cerca de 60 produtos aprovados em todas as categorias e marcas ativas (1 a 5 variações, estoque normal/baixo/esgotado, promoções ativas, futuras e expiradas, galerias com até 4 imagens); fila de moderação com rascunhos, enviados, recusados e arquivados; cerca de 95 pedidos nos últimos 120 dias em todas as etapas; ~130 avaliações de produto (1 a 5 estrelas, duas ocultadas pela moderação), ~45 avaliações de loja e ~60 perguntas (2/3 respondidas); 9 devoluções, 7 cancelamentos e 6 disputas em vários status; 10 cupons; auditoria, notificações, webhooks e eventos de outbox com falha. As imagens geradas mostram só a categoria e o selo "Demonstração" (sem marcas).

**Pedido de convidado** (sem conta): o seed imprime no final um link `http://localhost:3001/orders/MS-REVIEW-0008?accessToken=…`. Abra-o numa janela anônima para ver o acompanhamento sem login. O token muda a cada execução do seed.

**Verificação automática antes de apresentar:** com o servidor rodando (`pnpm dev:review`), o comando abaixo percorre todas as telas da loja, do cliente, da Central do Lojista e do Admin, no celular e no desktop. Ele confere se cada página abre sem erro, sem erro no console do navegador, sem rolagem lateral e com o conteúdo esperado. É **somente leitura**: só entra nas contas e navega, sem criar ou alterar dados.

```bash
DEMO_ADMIN_EMAIL=<conta em ADMIN_EMAILS> DEMO_ADMIN_PASSWORD=<senha> pnpm test:demo
```

Sem as duas variáveis, a parte do Admin é pulada. O relatório fica em `playwright-report-demo/index.html`.

---

## 3. Loja (sem entrar na conta)

Revise cada tela no **celular** (no Chrome: F12 → ícone de celular → iPhone/Pixel) e no desktop. O projeto é pensado primeiro para o celular.

| Tela               | Endereço                                                          | O que observar                                                                                                                                                        |
| ------------------ | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home               | `/`                                                               | Busca "Minha Moto" (fabricante → modelo → ano), categorias, produtos em destaque, rodapé                                                                              |
| Catálogo           | `/products`                                                       | Filtros (no celular, em "Filtrar produtos"), chips de filtro ativo, ordenação, paginação                                                                              |
| Busca              | `/products?q=capacete`                                            | Resultado da busca e estado vazio (`/products?q=xyz`)                                                                                                                 |
| Produto            | `/products/review-capacete-apex-pro` (ou clique em qualquer card) | Galeria, variações, preço/promoção, aviso de compatibilidade com a moto, frete por CEP, perguntas e avaliações. No celular, a barra fixa "Adicionar" aparece ao rolar |
| Loja               | `/loja/review-garagem-mx` e `/loja/review-box-77`                 | Vitrine com selo VIP (Garagem MX), filtros, produtos e avaliações da loja                                                                                             |
| Categoria          | `/categoria/<slug>` (pela home ou pelo produto)                   | Página de categoria                                                                                                                                                   |
| Marca              | `/marca/<slug>` (link da marca no produto)                        | Página de marca                                                                                                                                                       |
| Moto               | `/moto/<fabricante>/<modelo>/<ano>` (pela busca "Minha Moto")     | Peças compatíveis com a moto                                                                                                                                          |
| Carrinho           | `/cart`                                                           | Itens agrupados por loja, subtotal por loja, barra fixa no celular                                                                                                    |
| Checkout           | `/checkout`                                                       | Formulário (CEP preenche o endereço), cotação de frete, só Pix com produtos de teste e tela "Compra concluída" sem gravar pedido                                      |
| Login / cadastro   | `/login` e `/login?modo=cadastro`                                 | Erros por campo, botão de mostrar senha                                                                                                                               |
| Esqueci a senha    | `/forgot-password`                                                | Recuperação de acesso                                                                                                                                                 |
| Página inexistente | `/qualquer-coisa`                                                 | Tela de "não encontrado"                                                                                                                                              |

## 4. Área do cliente (`review.cliente@example.test`)

| Tela              | Endereço                                 | O que observar                                                                                                              |
| ----------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Meus pedidos      | `/orders`                                | Lista com status, filtros e busca                                                                                           |
| Detalhe do pedido | `/orders/<número>` (clique em um pedido) | Linha do tempo, rastreio, pagamento. Conforme a etapa: pedir cancelamento (pago), devolução e avaliação (entregue), disputa |
| Favoritos         | `/favorites`                             | Produtos salvos, remover favorito                                                                                           |
| Minhas motos      | `/account/motorcycles`                   | Garagem com moto principal                                                                                                  |
| Endereços         | `/account/addresses`                     | Endereço padrão, adicionar e remover                                                                                        |
| Notificações      | `/account/notifications`                 | Preferências de e-mail                                                                                                      |

Pedidos de demonstração (`/orders/MS-REVIEW-000X`):

| Pedido         | Situação                         | O que dá para ver                                     |
| -------------- | -------------------------------- | ----------------------------------------------------- |
| MS-REVIEW-0001 | Aguardando pagamento             | Reconsulta de pagamento, estoque reservado            |
| MS-REVIEW-0002 | Pago                             | Solicitação de cancelamento já aberta                 |
| MS-REVIEW-0003 | Em separação                     | Pedido em preparação pela loja                        |
| MS-REVIEW-0004 | Enviado                          | Código de rastreio e disputa aberta                   |
| MS-REVIEW-0005 | Entregue                         | Devolução solicitada, avaliações do produto e da loja |
| MS-REVIEW-0006 | Cancelado                        | Pedido encerrado                                      |
| MS-REVIEW-0007 | Duas lojas, parcialmente enviado | Um pedido dividido por loja, com cupom do marketplace |
| MS-REVIEW-0008 | Convidado                        | Só pelo link do seed (ver seção 2)                    |

Esses pedidos foram criados pelo seed (a compra simulada no checkout não grava pedidos), e os pagamentos são fictícios. "Reconsultar pagamento" e "Reprocessar webhook" podem mostrar erro do Mercado Pago sem alterar nada.

## 5. Central do Lojista (`review.lojista@example.test`)

| Tela           | Endereço                        | O que observar                                                                                                     |
| -------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Visão geral    | `/seller`                       | Indicadores, alertas de estoque, próximos passos                                                                   |
| Pedidos        | `/seller/orders`                | Pedidos por status, filtros, ações de envio (marcar como enviado/entregue)                                         |
| Produtos       | `/seller/products`              | Produtos em todos os status: rascunho, em análise, rejeitado (com motivo), aprovado e arquivado. Ajuste de estoque |
| Novo produto   | `/seller/products/new`          | Formulário com erro por campo e slug automático. Ao salvar, vai direto para a edição                               |
| Editar produto | "Editar" em um rascunho         | Fotos, status, motivo da rejeição, "Enviar para aprovação"                                                         |
| Perguntas      | `/seller/questions`             | Perguntas respondidas e pendentes                                                                                  |
| Frete          | `/seller/shipping`              | Modalidades de frete próprio (ativa e inativa)                                                                     |
| Integrações    | `/seller/shipping/integrations` | Conexão com o Melhor Envio                                                                                         |
| Cupons         | `/seller/coupons`               | Cupom ativo e cupom futuro                                                                                         |
| Configurações  | `/seller/settings`              | Perfil da loja, logo/banner, redes sociais, equipe                                                                 |

Compare com `review.catalogo@example.test`: o menu mostra só o que a função de catálogo permite.

Com `review.pendente@example.test`, a Central mostra a loja aguardando aprovação.

## 6. Admin (`review.admin@example.test`)

| Tela              | Endereço                   | O que observar                                     |
| ----------------- | -------------------------- | -------------------------------------------------- |
| Painel            | `/admin`                   | Contadores de pendências e saúde das integrações   |
| Lojistas          | `/admin/sellers`           | Aprovar a loja pendente, suspender e reativar      |
| Produtos          | `/admin/products`          | Moderação do produto em análise (aprovar/rejeitar) |
| Catálogo          | `/admin/catalog`           | Categorias, marcas, fabricantes, modelos e motos   |
| Cupons            | `/admin/coupons`           | Cupons do marketplace                              |
| Plano VIP         | `/admin/vip`               | Assinaturas das lojas                              |
| Comissão          | `/admin/commission`        | Comissão padrão e por loja                         |
| Pedidos           | `/admin/orders`            | Monitor de pedidos por loja                        |
| Cancelamentos     | `/admin/cancellations`     | Solicitação de cancelamento pendente               |
| Devoluções        | `/admin/returns`           | Devolução pendente                                 |
| Disputas          | `/admin/disputes`          | Disputa aberta                                     |
| Moderação         | `/admin/moderation`        | Ocultar e restaurar perguntas e avaliações         |
| Etiquetas         | `/admin/shipping-recovery` | Conferência de etiquetas                           |
| Integrações       | `/admin/integrations`      | Quais serviços externos estão configurados         |
| Webhooks          | `/admin/webhooks`          | Evento com falha e "Reprocessar"                   |
| E-mails           | `/admin/emails`            | Entrega com falha e "Reenviar"                     |
| Auditoria         | `/admin/audit`             | Histórico de ações administrativas                 |
| Eventos pendentes | `/admin/outbox`            | Eventos que exigem atenção                         |

---

## 7. O que mudou desde 12/10/2026

Uma linha por mudança: onde ver e com qual conta. "Sem conta" significa navegar sem entrar. As contas `review.*` usam a senha da seção 2. Itens marcados com **(seed novo)** só aparecem depois que o seed de revisão atualizado for rodado. Itens marcados com **(migration)** dependem de uma migration ainda não aplicada no banco da demo.

| Mudança                             | Onde ver                                                                                                                                                                 | Conta                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| Títulos "Moto Shop Brasil" nas abas | Nome da aba do navegador em qualquer página; na home, "Moto Shop Brasil - O Marketplace de quem vive o OFF-ROAD!"                                                        | Sem conta                                      |
| Selos e abas da home                | `/`: selos curtos logo abaixo da busca "Minha Moto"; a aba de busca de produto vem antes da aba de moto                                                                  | Sem conta                                      |
| 12 produtos em destaque             | `/`: três fileiras de destaques                                                                                                                                          | Sem conta                                      |
| Faixa de lojistas nova              | `/`, faixa laranja acima do rodapé: "Sua loja na pista certa." e "Quero vender no Moto Shop"                                                                             | Sem conta                                      |
| Rodapé novo                         | Rodapé de qualquer página da loja: descrição, Institucional, horário de atendimento, formas de pagamento, atalhos e o CNPJ                                               | Sem conta                                      |
| Busca com sugestões                 | Digite "capa" na busca do topo (ou da home): aparecem até 5 produtos com foto, nome e preço                                                                              | Sem conta                                      |
| Ordenação "Ofertas recentes"        | `/products`, `/loja/review-garagem-mx` e páginas de categoria: menu de ordenação                                                                                         | Sem conta                                      |
| Filtros com rolagem                 | `/products` no desktop: a coluna de filtros fica fixa e rola por dentro quando é mais alta que a tela                                                                    | Sem conta                                      |
| Selo "Novidade"                     | Cards e página de produtos aprovados há menos de 30 dias. Os produtos demo são mais antigos: aprove um produto em análise em `/admin/products` e veja o card no catálogo | `review.admin@example.test`                    |
| Cupons na página do produto         | `/products/<produto da Garagem MX>`: bloco "Cupons desta loja" abaixo do preço, com "Copiar código" **(seed novo)**                                                      | Sem conta                                      |
| Cupons que aparecem no produto      | `/seller/coupons`: opção de mostrar o cupom na página do produto                                                                                                         | `review.lojista@example.test`                  |
| Login com links de ajuda            | `/login`: entre com uma senha errada; aparecem "Esqueci minha senha" e "Ainda não tenho conta? Criar conta"                                                              | Sem conta (qualquer e-mail)                    |
| Garagem com campos separados        | `/account/motorcycles`: fabricante, modelo, versão e ano separados; moto sem peça compatível mostra o aviso                                                              | `review.cliente@example.test`                  |
| CPF/CNPJ e telefone                 | `/account/profile`: campos opcionais; depois, o `/checkout` vem com telefone e CPF preenchidos **(migration)**                                                           | `review.cliente@example.test`                  |
| Identificador da loja               | `/seller` com uma conta sem loja: o identificador é sugerido a partir do nome, com exemplo embaixo. Não envie o formulário                                               | Conta sem loja (ex.: `review.cliente2…`)       |
| Comissão do Admin em %              | `/admin/commission`: comissão padrão e por loja digitadas em percentual                                                                                                  | `review.admin@example.test`                    |
| Campanhas com adesão                | Regra de cupom do Moto Shop pago pela loja que aderir. Ainda sem tela de adesão; o seed cria uma campanha com uma loja aderente **(seed novo)**                          | `review.admin@example.test` (`/admin/coupons`) |
| Gênero, cor e tamanho nas variações | `/seller/products/new` ou "Editar" em um rascunho: campos de gênero, cor e tamanho em cada variação                                                                      | `review.lojista@example.test`                  |

## 8. Como dar feedback

Para cada observação, anote:

1. **Tela** (endereço da barra do navegador).
2. **Aparelho**: celular ou desktop.
3. **O que viu** e **o que esperava**. Um print ajuda muito.
4. **Prioridade**: impede o uso / incomoda / detalhe.

Pontos que precisam de decisão do dono do produto (registrados em `docs/auditoria-2026-10.md`):

- Link de WhatsApp na vitrine da loja: decidido em 08/10/2026, fica mantido (ver `AGENTS.md`).
- Códigos de cupom: o lojista pode usar qualquer código ou alguns ficam reservados ao marketplace?
- Quem aprova o merge para a `main` e o deploy.
