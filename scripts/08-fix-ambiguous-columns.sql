-- Corregir función para generar número de cotización
CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  new_quote_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(q.quote_number FROM 5) AS INTEGER)), 0) + 1
  INTO next_number
  FROM quotes q
  WHERE q.quote_number LIKE 'COT-%' AND q.quote_number ~ '^COT-[0-9]+$';
  
  new_quote_number := 'COT-' || LPAD(next_number::TEXT, 6, '0');
  RETURN new_quote_number;
END;
$$ LANGUAGE plpgsql;

-- Corregir función para generar número de venta
CREATE OR REPLACE FUNCTION generate_sale_number()
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  new_sale_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(s.sale_number FROM 4) AS INTEGER)), 0) + 1
  INTO next_number
  FROM sales s
  WHERE s.sale_number LIKE 'VT-%' AND s.sale_number ~ '^VT-[0-9]+$';
  
  new_sale_number := 'VT-' || LPAD(next_number::TEXT, 6, '0');
  RETURN new_sale_number;
END;
$$ LANGUAGE plpgsql;

-- Recrear triggers para asegurar que funcionen correctamente
DROP TRIGGER IF EXISTS trigger_set_quote_number ON quotes;
DROP TRIGGER IF EXISTS trigger_set_sale_number ON sales;

-- Crear trigger para auto-generar número de cotización
CREATE TRIGGER trigger_set_quote_number
  BEFORE INSERT ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION set_quote_number();

-- Crear trigger para auto-generar número de venta
CREATE TRIGGER trigger_set_sale_number
  BEFORE INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION set_sale_number();

-- Verificar que las funciones de trigger existan y estén correctas
CREATE OR REPLACE FUNCTION set_quote_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quote_number IS NULL OR NEW.quote_number = '' THEN
    NEW.quote_number := generate_quote_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_sale_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sale_number IS NULL OR NEW.sale_number = '' THEN
    NEW.sale_number := generate_sale_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
