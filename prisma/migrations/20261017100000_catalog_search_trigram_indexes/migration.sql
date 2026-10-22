-- Busca por texto do catálogo (A10): o filtro usa ILIKE '%termo%' em nome, descrição e SKU,
-- que sem índice lê a tabela inteira. Índices de trigramas (pg_trgm) atendem ILIKE com curinga
-- dos dois lados. A extensão vem antes dos índices; IF NOT EXISTS evita falha onde ela já existe.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "products_name_trgm_idx" ON "products" USING GIN ("name" gin_trgm_ops);

CREATE INDEX "products_description_trgm_idx" ON "products" USING GIN ("description" gin_trgm_ops);

CREATE INDEX "product_variants_sku_trgm_idx" ON "product_variants" USING GIN ("sku" gin_trgm_ops);
