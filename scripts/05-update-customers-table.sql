-- Agregar columna de porcentaje de descuento a la tabla de clientes
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5,2) DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100);

-- Actualizar clientes existentes para que tengan 0% de descuento por defecto
UPDATE customers 
SET discount_percentage = 0 
WHERE discount_percentage IS NULL;
