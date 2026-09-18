ALTER TABLE "stores" ADD COLUMN "originName" TEXT;
ALTER TABLE "stores" ADD COLUMN "originEmail" TEXT;
ALTER TABLE "stores" ADD COLUMN "originPhone" TEXT;
ALTER TABLE "stores" ADD COLUMN "originDocument" TEXT;
ALTER TABLE "stores" ADD COLUMN "originStreet" TEXT;
ALTER TABLE "stores" ADD COLUMN "originNumber" TEXT;
ALTER TABLE "stores" ADD COLUMN "originComplement" TEXT;
ALTER TABLE "stores" ADD COLUMN "originNeighborhood" TEXT;
ALTER TABLE "stores" ADD COLUMN "originCity" TEXT;
ALTER TABLE "stores" ADD COLUMN "originState" TEXT;
ALTER TABLE "stores" ADD COLUMN "originStateRegister" TEXT;

ALTER TABLE "order_items" ADD COLUMN "weightInGramsSnapshot" INTEGER;
ALTER TABLE "order_items" ADD COLUMN "heightInMillimetersSnapshot" INTEGER;
ALTER TABLE "order_items" ADD COLUMN "widthInMillimetersSnapshot" INTEGER;
ALTER TABLE "order_items" ADD COLUMN "lengthInMillimetersSnapshot" INTEGER;
