-- Crear tabla para movimientos de caja (entradas y salidas rápidas)
CREATE TABLE IF NOT EXISTS cash_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type VARCHAR(20) CHECK (type IN ('entrada', 'salida')),
  amount DECIMAL(10,2) NOT NULL,
  concept VARCHAR(255) NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla para créditos de clientes
CREATE TABLE IF NOT EXISTS customer_credits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  total_amount DECIMAL(10,2) NOT NULL,
  paid_amount DECIMAL(10,2) DEFAULT 0,
  remaining_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'pagado', 'cancelado')),
  due_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla para pagos de créditos
CREATE TABLE IF NOT EXISTS credit_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  credit_id UUID REFERENCES customer_credits(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50),
  notes TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_payments ENABLE ROW LEVEL SECURITY;

-- Políticas para movimientos de caja
CREATE POLICY "Users can view cash movements" ON cash_movements FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert cash movements" ON cash_movements FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Políticas para créditos
CREATE POLICY "Users can view customer credits" ON customer_credits FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert customer credits" ON customer_credits FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update customer credits" ON customer_credits FOR UPDATE USING (auth.role() = 'authenticated');

-- Políticas para pagos de créditos
CREATE POLICY "Users can view credit payments" ON credit_payments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert credit payments" ON credit_payments FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Función para actualizar el monto restante del crédito
CREATE OR REPLACE FUNCTION update_credit_remaining()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE customer_credits 
  SET 
    paid_amount = (
      SELECT COALESCE(SUM(amount), 0) 
      FROM credit_payments 
      WHERE credit_id = NEW.credit_id
    ),
    remaining_amount = total_amount - (
      SELECT COALESCE(SUM(amount), 0) 
      FROM credit_payments 
      WHERE credit_id = NEW.credit_id
    ),
    status = CASE 
      WHEN total_amount <= (
        SELECT COALESCE(SUM(amount), 0) 
        FROM credit_payments 
        WHERE credit_id = NEW.credit_id
      ) THEN 'pagado'
      ELSE 'pendiente'
    END,
    updated_at = NOW()
  WHERE id = NEW.credit_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar créditos
CREATE TRIGGER trigger_update_credit_remaining
  AFTER INSERT ON credit_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_credit_remaining();

-- Agregar campo para tipo de venta (contado o crédito)
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS sale_type VARCHAR(20) DEFAULT 'contado' CHECK (sale_type IN ('contado', 'credito'));
