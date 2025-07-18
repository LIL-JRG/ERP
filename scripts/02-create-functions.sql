-- Función para actualizar stock automáticamente
CREATE OR REPLACE FUNCTION update_product_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.movement_type = 'entrada' THEN
    UPDATE products 
    SET stock_quantity = stock_quantity + NEW.quantity,
        updated_at = NOW()
    WHERE id = NEW.product_id;
  ELSIF NEW.movement_type = 'salida' THEN
    UPDATE products 
    SET stock_quantity = stock_quantity - NEW.quantity,
        updated_at = NOW()
    WHERE id = NEW.product_id;
  ELSIF NEW.movement_type = 'ajuste' THEN
    UPDATE products 
    SET stock_quantity = NEW.quantity,
        updated_at = NOW()
    WHERE id = NEW.product_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para actualizar stock
CREATE TRIGGER trigger_update_stock
  AFTER INSERT ON inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_product_stock();

-- Función para generar número de cotización
CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  quote_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(quote_number FROM 5) AS INTEGER)), 0) + 1
  INTO next_number
  FROM quotes
  WHERE quote_number LIKE 'COT-%';
  
  quote_number := 'COT-' || LPAD(next_number::TEXT, 6, '0');
  RETURN quote_number;
END;
$$ LANGUAGE plpgsql;

-- Función para generar número de venta
CREATE OR REPLACE FUNCTION generate_sale_number()
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  sale_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(sale_number FROM 4) AS INTEGER)), 0) + 1
  INTO next_number
  FROM sales
  WHERE sale_number LIKE 'VT-%';
  
  sale_number := 'VT-' || LPAD(next_number::TEXT, 6, '0');
  RETURN sale_number;
END;
$$ LANGUAGE plpgsql;
