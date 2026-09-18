UPDATE "order_items" AS oi
SET
  "weightInGramsSnapshot" = COALESCE(pv."weightInGrams", p."weightInGrams"),
  "heightInMillimetersSnapshot" = COALESCE(pv."heightInMillimeters", p."heightInMillimeters"),
  "widthInMillimetersSnapshot" = COALESCE(pv."widthInMillimeters", p."widthInMillimeters"),
  "lengthInMillimetersSnapshot" = COALESCE(pv."lengthInMillimeters", p."lengthInMillimeters")
FROM "product_variants" AS pv
JOIN "products" AS p ON p."id" = pv."productId" AND p."sellerId" = pv."sellerId"
WHERE oi."variantId" = pv."id"
  AND oi."productId" = p."id"
  AND (
    oi."weightInGramsSnapshot" IS NULL
    OR oi."heightInMillimetersSnapshot" IS NULL
    OR oi."widthInMillimetersSnapshot" IS NULL
    OR oi."lengthInMillimetersSnapshot" IS NULL
  );

UPDATE "order_items" AS oi
SET
  "weightInGramsSnapshot" = p."weightInGrams",
  "heightInMillimetersSnapshot" = p."heightInMillimeters",
  "widthInMillimetersSnapshot" = p."widthInMillimeters",
  "lengthInMillimetersSnapshot" = p."lengthInMillimeters"
FROM "products" AS p
WHERE oi."productId" = p."id"
  AND oi."variantId" IS NULL
  AND (
    oi."weightInGramsSnapshot" IS NULL
    OR oi."heightInMillimetersSnapshot" IS NULL
    OR oi."widthInMillimetersSnapshot" IS NULL
    OR oi."lengthInMillimetersSnapshot" IS NULL
  );
