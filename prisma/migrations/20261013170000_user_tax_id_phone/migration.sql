-- Optional CPF/CNPJ and phone on the customer profile (digits only). Additive: existing users keep NULL.
ALTER TABLE "users" ADD COLUMN "taxId" TEXT,
ADD COLUMN "phone" TEXT;
