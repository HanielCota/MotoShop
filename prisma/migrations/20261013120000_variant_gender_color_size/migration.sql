-- Atributos estruturados da variante para filtros da vitrine. Colunas opcionais:
-- variantes existentes ficam com NULL e nada muda nelas.
CREATE TYPE "VariantGender" AS ENUM ('MALE', 'FEMALE', 'UNISEX');

ALTER TABLE "product_variants"
ADD COLUMN "gender" "VariantGender",
ADD COLUMN "color" TEXT,
ADD COLUMN "size" TEXT;

CREATE INDEX "product_variants_gender_active_idx" ON "product_variants"("gender", "active");
CREATE INDEX "product_variants_color_active_idx" ON "product_variants"("color", "active");
CREATE INDEX "product_variants_size_active_idx" ON "product_variants"("size", "active");
