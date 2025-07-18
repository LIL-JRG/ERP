-- Limpiar datos de prueba que puedan estar causando conflictos

-- Verificar si hay registros con números duplicados o nulos
SELECT 'Cotizaciones con números duplicados:' as info;
SELECT quote_number, COUNT(*) 
FROM quotes 
WHERE quote_number IS NOT NULL 
GROUP BY quote_number 
HAVING COUNT(*) > 1;

SELECT 'Ventas con números duplicados:' as info;
SELECT sale_number, COUNT(*) 
FROM sales 
WHERE sale_number IS NOT NULL 
GROUP BY sale_number 
HAVING COUNT(*) > 1;

-- Verificar registros con números nulos
SELECT 'Cotizaciones con números nulos:' as info;
SELECT COUNT(*) as count_null_quotes
FROM quotes 
WHERE quote_number IS NULL;

SELECT 'Ventas con números nulos:' as info;
SELECT COUNT(*) as count_null_sales
FROM sales 
WHERE sale_number IS NULL;

-- Si hay registros con números nulos, asignarles números únicos
UPDATE quotes 
SET quote_number = generate_quote_number() 
WHERE quote_number IS NULL;

UPDATE sales 
SET sale_number = generate_sale_number() 
WHERE sale_number IS NULL;

-- Verificar el estado final
SELECT 'Estado final - Cotizaciones:' as info;
SELECT 
  COUNT(*) as total_quotes,
  COUNT(quote_number) as quotes_with_numbers,
  MAX(quote_number) as last_quote_number
FROM quotes;

SELECT 'Estado final - Ventas:' as info;
SELECT 
  COUNT(*) as total_sales,
  COUNT(sale_number) as sales_with_numbers,
  MAX(sale_number) as last_sale_number
FROM sales;
