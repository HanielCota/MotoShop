-- Company and contact edited in Admin › Configurações. Every column is optional: an empty one
-- falls back to the text in the code, so existing rows keep showing what they show today.
ALTER TABLE "marketplace_configurations"
  ADD COLUMN "companyLegalName" TEXT,
  ADD COLUMN "companyCnpj" TEXT,
  ADD COLUMN "supportEmail" TEXT,
  ADD COLUMN "supportPhone" TEXT,
  ADD COLUMN "instagramUrl" TEXT,
  ADD COLUMN "youtubeUrl" TEXT,
  ADD COLUMN "weekdayHours" TEXT,
  ADD COLUMN "saturdayHours" TEXT,
  ADD COLUMN "sundayHolidayHours" TEXT;

-- The marketplace has a single configuration row; the code always reads and writes key 'default'.
ALTER TABLE "marketplace_configurations"
  ADD CONSTRAINT "marketplace_config_single_row_check" CHECK ("key" = 'default');
