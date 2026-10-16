-- Categoria universal: itens que servem em qualquer moto passam pelo filtro de moto.
-- Ligada só pelo Admin; categorias existentes começam desligadas.
ALTER TABLE "categories" ADD COLUMN "universal" BOOLEAN NOT NULL DEFAULT false;
