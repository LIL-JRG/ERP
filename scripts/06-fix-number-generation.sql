-- Actualizar función para generar número de cotización
CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  quote_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(quote_number FROM 5) AS INTEGER)), 0) + 1
  INTO next_number
  FROM quotes
  WHERE quote_number LIKE 'COT-%' AND quote_number ~ '^COT-[0-9]+$';
  
  quote_number := 'COT-' || LPAD(next_number::TEXT, 6, '0');
  RETURN quote_number;
END;
$$ LANGUAGE plpgsql;

-- Actualizar función para generar número de venta
CREATE OR REPLACE FUNCTION generate_sale_number()
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  sale_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(sale_number FROM 4) AS INTEGER)), 0) + 1
  INTO next_number
  FROM sales
  WHERE sale_number LIKE 'VT-%' AND sale_number ~ '^VT-[0-9]+$';
  
  sale_number := 'VT-' || LPAD(next_number::TEXT, 6, '0');
  RETURN sale_number;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para auto-generar número de cotización
CREATE OR REPLACE FUNCTION set_quote_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quote_number IS NULL THEN
    NEW.quote_number := generate_quote_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para auto-generar número de venta
CREATE OR REPLACE FUNCTION set_sale_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sale_number IS NULL THEN
    NEW.sale_number := generate_sale_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers
DROP TRIGGER IF EXISTS trigger_set_quote_number ON quotes;
CREATE TRIGGER trigger_set_quote_number
  BEFORE INSERT ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION set_quote_number();

DROP TRIGGER IF EXISTS trigger_set_sale_number ON sales;
CREATE TRIGGER trigger_set_sale_number
  BEFORE INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION set_sale_number();
