-- Motivo da recusa do cadastro da loja (BUG-005), exigido pelo Admin e exibido ao lojista.
-- Lojas já recusadas ficam sem motivo registrado.
ALTER TABLE "sellers" ADD COLUMN "rejectionReason" TEXT;
