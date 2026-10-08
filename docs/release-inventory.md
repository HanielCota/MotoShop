# Inventário local da versão candidata — 05/10/2026

Este inventário classifica o estado de trabalho encontrado na T01. **Candidato** significa que o arquivo pertence ao trabalho do Moto Shop; não significa que já passou pelas validações T02–T06 ou que pode ser publicado. Nenhum arquivo preexistente foi apagado, revertido ou movido.

## Candidato à versão, ainda sujeito a revisão

- **Controle e documentação:** `.gitignore`, `.vercelignore`, `docs/mvp-checklist.md`, `docs/release-inventory.md`, `docs/manual-route-matrix.md`, `docs/production-readiness.md`.
- **Banco e migrações:** `prisma/schema.prisma`, `prisma/migrations/20261002100000_durable_event_outbox/migration.sql`, `prisma/migrations/20261002103000_shipment_generation_safety/migration.sql`. As migrações precisam acompanhar as alterações de schema e serviço.
- **Rotas e telas operacionais:** `src/app/(admin)/admin/page.tsx`, `src/app/(admin)/admin/[section]/page.tsx`, `src/app/(admin)/admin/outbox/page.tsx`, `src/app/(admin)/admin/shipping-recovery/page.tsx`, `src/app/(seller)/seller/page.tsx`, `src/app/(seller)/seller/orders/page.tsx`, `src/app/loja/[slug]/page.tsx`, `src/app/api/inngest/route.ts`. A vitrine da loja passou a distinguir filtro sem resultados de loja sem produtos em 06/10.
- **Admin:** `src/modules/admin/admin-sections.ts`, `src/modules/admin/components/admin-navigation.tsx`, `src/modules/admin/components/admin-section-content.tsx`, `src/modules/admin/actions/marketplace-configuration-actions.ts`, o teste correspondente, ações e consultas de recuperação de frete e outbox. O painel único foi desmembrado em rotas por função em 07/10; a comissão passou a rejeitar envio vazio e auditar a leitura anterior na mesma transação.
- **Autorização:** `src/modules/auth/application/authorization.test.ts`, `src/modules/auth/domain/seller-permissions.test.ts`.
- **Perguntas:** `src/modules/questions/actions/question-actions.ts`, `src/modules/questions/actions/question-actions.test.ts`. A resposta do seller foi reforçada durante a T03 em 05/10/2026.
- **Cupons:** `src/modules/coupons/actions/coupon-actions.ts`, `src/modules/coupons/actions/coupon-actions.test.ts`, `src/modules/coupons/components/coupon-form.tsx`, `src/modules/coupons/domain/coupon-discount.ts`, `src/modules/coupons/domain/coupon-discount.test.ts`. As actions e seus testes foram acrescentados em 05/10/2026 durante a T03.
- **Pagamentos e outbox:** `src/modules/payments/application/reconcile-payment.ts`; `src/modules/outbox/application/record-outbox-event.ts`, `src/modules/outbox/application/dispatch-outbox-events.ts`, `src/modules/outbox/application/dispatch-outbox-events.test.ts`, `src/modules/outbox/domain/outbox-events.ts`, `src/modules/outbox/workflows/dispatch-outbox-workflow.ts`. A entrega de notificações agora depende da migração e do workflow; revisar como conjunto.
- **Produto, imagens e loja:** `src/modules/products/actions/product-actions.ts`, `src/modules/products/actions/product-actions.test.ts`, `src/modules/products/actions/product-image-actions.ts`, `src/modules/products/actions/product-image-actions.test.ts`, `src/modules/products/components/product-image-manager.tsx`, `src/modules/reviews/components/review-form.tsx`, `src/modules/sellers/actions/store-branding-actions.ts`, `src/modules/sellers/actions/store-branding-actions.test.ts`, `src/modules/sellers/actions/store-profile-actions.ts`, `src/modules/sellers/actions/store-profile-actions.test.ts`, `src/modules/sellers/components/store-branding-manager.tsx`. A atualização do perfil e seus testes foram acrescentados em 05/10/2026 durante a T03.
- **Frete e fulfillment:** `src/modules/shipping/actions/fulfillment-actions.ts`, `src/modules/shipping/application/fulfill-seller-order.ts`, `src/modules/shipping/application/fulfill-seller-order.test.ts`, `src/modules/shipping/application/own-shipping.ts`, `src/modules/shipping/application/reconcile-shipment-purchase.ts`, `src/modules/shipping/application/reconcile-shipment-purchase.test.ts`, `src/modules/shipping/application/reconcile-shipment-generation.ts`, `src/modules/shipping/application/reconcile-shipment-generation.test.ts`, `src/modules/shipping/components/shipment-actions.tsx`.
- **Checkout e testes de jornada/integração:** `src/modules/checkout/components/checkout-form.tsx`, `tests/e2e/marketplace.spec.ts`, `tests/integration/checkout.test.ts`, `tests/support/database.ts`. Em 06/10, o checkout recebeu uma correção de largura mobile e uma regressão E2E em 390/320 px.

## Material local preservado e excluído da versão

- `tmp/`: 29 arquivos de prévia/feedback, cerca de 25 MB. Permanece no disco e está excluído do Git e do pacote Vercel.
- `public/MotoShopBrasil-Avatar.psd` e `public/MotoShopBrasil-Logo.psd`: fontes de arte, cerca de 17,7 MB juntos. Permanecem no disco e estão excluídos do Git e do pacote Vercel.
- `public/images/demo/freitas-qa-oculos.webp`: foto de QA sem referência encontrada no código. Permanece no disco e está excluída do Git e do pacote Vercel; não levar ao catálogo oficial sem decisão sobre conteúdo.
- `.env.local`: credenciais locais; já ignorado por Git e Vercel. Seu conteúdo não foi incluído neste inventário.
- `.next-build-check/`: saída temporária do build de verificação em 07/10; foi excluída de Git e Vercel, sem integrar a versão.

## Verificações desta classificação

- `git status --short` não mostrou exclusões nem arquivos de apoio após as regras de ignore.
- `git check-ignore -v` confirmou o ignore dos quatro grupos locais acima (amostrando um arquivo de `tmp/`).
- Busca por padrões de credenciais nos arquivos alterados e novos elegíveis para a versão não encontrou correspondências. Isso é uma varredura de padrões, não garantia absoluta de ausência de segredos. Uma busca mais ampla encontrou somente `.env.example` e um teste de ambiente preexistentes, que não fazem parte do diff atual.
- `git diff --check` passou; os avisos de conversão LF/CRLF são da configuração local de Git.

**Próxima decisão técnica:** T02–T05 verificam o comportamento e a segurança do conjunto candidato; T06 decide sua composição final e registra os commits. Não fazer `git add .` sem revisar este inventário e o status atual.
