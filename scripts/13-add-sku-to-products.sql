-- Agregar columna SKU a la tabla products si no existe
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku VARCHAR(100) UNIQUE;

-- Crear índice para búsquedas rápidas por SKU
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

-- Agregar comentarios para documentación
COMMENT ON COLUMN products.sku IS 'Stock Keeping Unit - Código único del producto para identificación interna';
