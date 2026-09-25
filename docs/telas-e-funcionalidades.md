# Inventário de telas e funcionalidades — 25/09/2026

Levantamento por rotas, componentes, Server Actions, serviços e schema. **Ter código ou tela não significa estar homologado para vendas reais.** Algumas áreas administrativas e do lojista são seções grandes da mesma página, não telas independentes.

## 1. Telas existentes

| Rota | Funções ligadas à interface | Limitação relevante |
| --- | --- | --- |
| `/` | Landing comercial, identidade visual, categorias, chamadas para catálogo/lojistas e seleção inicial da moto principal | Vitrine de produtos de demonstração; não representa estoque real |
| `/products` | Busca, categoria, marca, loja, compatibilidade, atalho da moto principal, preço, disponibilidade, promoção, ordenação e paginação | Exibe produtos aprovados e lojas ativas/aprovadas; a URL controla o filtro efetivo |
| `/products/[slug]` | Produto, imagens, variantes, preço, estoque, indicação de compatibilidade da moto principal, carrinho, favorito, perguntas e avaliações | Imagens reais dependem do R2; compatibilidade não cadastrada não prova incompatibilidade |
| `/categoria/[slug]` | Catálogo por categoria, filtros e paginação | Categoria governada pelo Admin |
| `/marca/[slug]` | Catálogo por marca, filtros e paginação | Marca governada pelo Admin |
| `/moto/[manufacturerSlug]/[modelSlug]/[year]` | Produtos compatíveis com a moto/ano | Não é uma garagem pessoal de motos salvas |
| `/loja/[slug]` | Vitrine pública, identidade da loja, catálogo e reputação | Logo/banner dependem do storage |
| `/login` | Cadastro, entrada por e-mail/senha e sessão | Sem jornada de recuperação de senha/verificação de e-mail implementada |
| `/cart` | Carrinho persistente, itens por loja, quantidade, remoção e resumo | Preços/estoque são revalidados no checkout |
| `/checkout` | Dados do comprador, endereços salvos, frete por loja, cupom, Pix e cartão de crédito em 1 parcela | Cartão implementado com Secure Fields, mas sem homologação real; cobrança multi-lojista bloqueada |
| `/checkout/success` | Página de pedido criado e link de acompanhamento | Existe, mas o checkout atual navega diretamente ao detalhe do pedido |
| `/orders` | Histórico autenticado, filtros e paginação | Somente pedidos associados ao usuário |
| `/orders/[orderNumber]` | Acompanhamento, envios, Pix, consulta de pagamento, devolução, cancelamento, disputa e avaliação | Convidado exige token seguro; avaliação exige conta e compra válida |
| `/favorites` | Favoritos, busca, disponibilidade, ordenação e paginação | Exige conta |
| `/account/addresses` | Cadastro/gestão de endereços e endereço padrão | Dados isolados por usuário |
| `/account/motorcycles` | Salvar, editar, remover e definir moto principal; links para peças compatíveis | Exige conta; opções vêm da base de motos administrada |
| `/account/notifications` | Preferências de e-mails de atualização | Entrega real depende de Resend/Inngest |
| `/seller` | Cadastro da loja ou dashboard; perfil, identidade visual, origem de envio, equipe/permissões, cupons, resumo financeiro, estoque baixo, histórico de estoque, catálogo e status VIP | Central concentra várias áreas numa única página; equipe usa usuários já cadastrados |
| `/seller/products/new` | Novo produto, variantes, SKU, preço, estoque, compatibilidade, promoções e medidas da embalagem | Medidas opcionais no rascunho; variações herdam medidas padrão quando não preenchidas |
| `/seller/products/[id]/edit` | Edição, imagens, capa/ordenação e submissão para aprovação | Edição restrita a rascunhos/rejeitados; upload depende de R2 |
| `/seller/orders` | Lista/filtros de pedidos, separação por loja, ações de envio e rastreio | Frete próprio funciona sem Melhor Envio; etiquetas dependem da integração |
| `/seller/shipping` | Criar, ativar/desativar frete próprio por faixa de CEP, preço e prazo | Não é conexão OAuth com transportadora |
| `/seller/questions` | Consultar e responder perguntas públicas | Não existe chat privado, por decisão do MVP |
| `/admin` | Catálogo de categorias/marcas/motos; comissão global e individual; aprovação/suspensão de lojistas; aprovação de produtos; pedidos; cupons globais; VIP manual; devoluções/reembolsos; cancelamentos; disputas; auditoria; eventos/retry de webhook; entregas de notificações e situação das integrações | Configuração presente não equivale a integração funcional; comissão individual fica na listagem de lojistas |
| `/forbidden` | Aviso de acesso negado | Tela utilitária |

## 2. Suporte existente sem formulário ou sem ligação direta à tela

| Recurso | O que existe | O que falta |
| --- | --- | --- |
| Reembolso avulso | `refundPaymentAction` e serviço de reembolso | Formulário próprio para essa Action. **Reembolsos vinculados a devoluções/cancelamentos já têm ações nas telas administrativas** |
| Cliente Redis | `getRedisClient` e configuração | Não há chamadas do cliente nos fluxos examinados; proteção por rate limit não deve ser considerada implementada apenas por existir Redis |
| Página de sucesso | `/checkout/success` renderizada | Não é destino do fluxo atual, que vai direto a `/orders/[orderNumber]` |
| Action auxiliar de remoção de carrinho | `removeCartItemAction` sem consumidor direto | Não é lacuna funcional: o botão Remover já chama `updateCartItemAction(..., 0)` |

Os workflows de reconciliação, recuperação de pendências e envio de e-mails são processos de bastidor. Não precisam de tela de execução para funcionar; existem monitores administrativos para eventos/notificações. Dependem do Inngest ativo.

## 3. Tela existente, mas integração externa pendente

- **Cartão:** campos seguros/tokenização e envio ao provider implementados; Public Key de teste configurada. Compra aprovada/recusada com SDK e gateway reais ainda não homologada.
- **Pix:** criação e consulta reais em sandbox já verificadas; pagamento aprovado e confirmação automática ponta a ponta não comprovados.
- **Webhook:** endpoint assinado, persistência, deduplicação, fila e retry implementados. Assinatura e URL exclusivas desta execução ainda pendentes. O painel compartilhado aponta para outro projeto; não foi sobrescrito nem recebeu teste nosso.
- **Melhor Envio:** cotação, etiqueta e rastreio ligados a ações/telas, sem homologação externa. Não há OAuth por lojista; o adapter usa configuração de ambiente. Frete próprio é alternativa já implementada.
- **R2:** upload/galeria de produto e identidade visual da loja ligados à interface; faltam credenciais/CORS e validação do upload real.
- **Resend/Inngest:** preferências, templates, jobs e monitor de entregas existem; envio real e processamento contínuo não homologados. Modo local do Inngest configurado, não significa servidor iniciado.

## 4. Não implementado como fluxo completo

- Recuperação de senha e verificação de e-mail com telas e envio configurados.
- Vincular com segurança compras de convidado a uma conta posterior.
- Cobrança recorrente automática do VIP; hoje ativação/renovação é administrativa.
- Campanhas/vitrines patrocinadas gerenciáveis; existe o sinal de exposição VIP no ranking.
- Anexos/fotos e conversa de mediação em devoluções/disputas; existem solicitação textual e mudança de status.
- Moderação administrativa dedicada de perguntas/avaliações.
- Convites de equipe por e-mail; hoje o membro precisa ter conta existente.
- Pipeline próprio de versões de imagens (original/large/medium/thumbnail); dependência Sharp não equivale ao fluxo pronto.
- Relatórios avançados/exportações e conciliação de repasses por lojista; o resumo financeiro atual não é uma conta de saldo/saques.
- Conexões OAuth de Mercado Pago/Melhor Envio por lojista e split financeiro. **Adiadas conforme orientação do responsável; não bloqueiam o desenvolvimento local das demais áreas.**

Chat privado e venda de motos completas no checkout não são lacunas desta entrega: estão fora do MVP pelo AGENTS.md.

## Verificações desta entrega

- 150 testes unitários aprovados.
- 15 testes de integração aprovados, incluindo promoção, medidas por variante e preservação da comissão em pedidos antigos.
- 2 testes de navegador aprovados: desktop e celular.
- Lint e compilação de produção aprovados, incluindo a verificação TypeScript.
- Os testes de navegador simulam o SDK de cartão e não realizam cobranças. Não substituem a homologação com Mercado Pago real.
- Garagem pessoal: novo teste de integração valida isolamento entre usuários, configuração única, edição, troca e promoção da moto principal; jornada de navegador aprovada em desktop e celular. A nova rota também passou na compilação de produção.

## Próxima prioridade sem dependências externas

**Minha Moto pessoal agora possui garagem por usuário**, moto principal e ligação à landing, ao catálogo e ao detalhe do produto. Próxima frente sugerida: recuperação de senha e verificação de e-mail, mantendo as integrações externas pendentes separadas.
