-- Agregar campos de precio público y precio puesto a la tabla products
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS public_price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS wholesale_price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS has_variants BOOLEAN DEFAULT FALSE;

-- Migrar precios existentes (asumir que el precio actual es precio público)
UPDATE products 
SET public_price = price, wholesale_price = cost * 1.3 
WHERE public_price IS NULL;

-- Crear tabla para variantes de productos
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL, -- Ej: "Talla M", "Color Rojo", "Modelo 2024"
  sku VARCHAR(100), -- Código específico de la variante
  barcode VARCHAR(100), -- Código de barras específico
  public_price DECIMAL(10,2), -- Precio público de la variante (puede ser diferente al producto base)
  wholesale_price DECIMAL(10,2), -- Precio puesto de la variante
  stock_quantity INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla para atributos de variantes (color, talla, etc.)
CREATE TABLE IF NOT EXISTS variant_attributes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  attribute_name VARCHAR(100) NOT NULL, -- Ej: "Color", "Talla", "Modelo"
  attribute_values TEXT[] NOT NULL, -- Ej: ["Rojo", "Azul", "Verde"]
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla para combinaciones de atributos por variante
CREATE TABLE IF NOT EXISTS variant_attribute_values (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  attribute_name VARCHAR(100) NOT NULL,
  attribute_value VARCHAR(100) NOT NULL
);

-- Agregar campos para el manejo de cambio en las ventas
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS change_amount DECIMAL(10,2) DEFAULT 0;

-- Modificar sale_items para incluir información de variante y tipo de precio
ALTER TABLE sale_items 
ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id),
ADD COLUMN IF NOT EXISTS price_type VARCHAR(20) DEFAULT 'public' CHECK (price_type IN ('public', 'wholesale'));

-- Modificar quote_items también
ALTER TABLE quote_items 
ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id),
ADD COLUMN IF NOT EXISTS price_type VARCHAR(20) DEFAULT 'public' CHECK (price_type IN ('public', 'wholesale'));

-- Habilitar RLS para las nuevas tablas
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_attribute_values ENABLE ROW LEVEL SECURITY;

-- Políticas para variantes de productos
CREATE POLICY "Users can view product variants" ON product_variants FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert product variants" ON product_variants FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update product variants" ON product_variants FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete product variants" ON product_variants FOR DELETE USING (auth.role() = 'authenticated');

-- Políticas para atributos de variantes
CREATE POLICY "Users can view variant attributes" ON variant_attributes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert variant attributes" ON variant_attributes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update variant attributes" ON variant_attributes FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete variant attributes" ON variant_attributes FOR DELETE USING (auth.role() = 'authenticated');

-- Políticas para valores de atributos de variantes
CREATE POLICY "Users can view variant attribute values" ON variant_attribute_values FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert variant attribute values" ON variant_attribute_values FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update variant attribute values" ON variant_attribute_values FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete variant attribute values" ON variant_attribute_values FOR DELETE USING (auth.role() = 'authenticated');

-- Función para actualizar el stock total del producto cuando cambian las variantes
CREATE OR REPLACE FUNCTION update_product_total_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Actualizar el stock total del producto sumando todas sus variantes
  UPDATE products 
  SET stock_quantity = (
    SELECT COALESCE(SUM(stock_quantity), 0) 
    FROM product_variants 
    WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
    AND is_active = TRUE
  )
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers para actualizar stock del producto
CREATE TRIGGER trigger_update_product_stock_on_variant_insert
  AFTER INSERT ON product_variants
  FOR EACH ROW
  EXECUTE FUNCTION update_product_total_stock();

CREATE TRIGGER trigger_update_product_stock_on_variant_update
  AFTER UPDATE ON product_variants
  FOR EACH ROW
  EXECUTE FUNCTION update_product_total_stock();

CREATE TRIGGER trigger_update_product_stock_on_variant_delete
  AFTER DELETE ON product_variants
  FOR EACH ROW
  EXECUTE FUNCTION update_product_total_stock();

-- Función para obtener el precio correcto según el tipo
CREATE OR REPLACE FUNCTION get_product_price(
  p_product_id UUID,
  p_variant_id UUID DEFAULT NULL,
  p_price_type VARCHAR DEFAULT 'public'
)
RETURNS DECIMAL AS $$
DECLARE
  result_price DECIMAL;
BEGIN
  IF p_variant_id IS NOT NULL THEN
    -- Obtener precio de la variante
    SELECT 
      CASE 
        WHEN p_price_type = 'wholesale' THEN wholesale_price
        ELSE public_price
      END INTO result_price
    FROM product_variants 
    WHERE id = p_variant_id;
  ELSE
    -- Obtener precio del producto base
    SELECT 
      CASE 
        WHEN p_price_type = 'wholesale' THEN wholesale_price
        ELSE public_price
      END INTO result_price
    FROM products 
    WHERE id = p_product_id;
  END IF;
  
  RETURN COALESCE(result_price, 0);
END;
$$ LANGUAGE plpgsql;
