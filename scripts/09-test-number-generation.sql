-- Script de prueba para verificar la generación de números

-- Probar generación de números de cotización
DO $$
DECLARE
  test_quote_number TEXT;
BEGIN
  -- Generar un número de cotización de prueba
  SELECT generate_quote_number() INTO test_quote_number;
  RAISE NOTICE 'Número de cotización generado: %', test_quote_number;
END $$;

-- Probar generación de números de venta
DO $$
DECLARE
  test_sale_number TEXT;
BEGIN
  -- Generar un número de venta de prueba
  SELECT generate_sale_number() INTO test_sale_number;
  RAISE NOTICE 'Número de venta generado: %', test_sale_number;
END $$;

-- Verificar que los triggers están activos
SELECT 
  trigger_name, 
  event_manipulation, 
  action_timing, 
  action_statement
FROM information_schema.triggers 
WHERE trigger_name IN ('trigger_set_quote_number', 'trigger_set_sale_number');

-- Mostrar las funciones existentes
SELECT 
  routine_name, 
  routine_type,
  routine_definition
FROM information_schema.routines 
WHERE routine_name IN ('generate_quote_number', 'generate_sale_number', 'set_quote_number', 'set_sale_number')
AND routine_schema = 'public';
