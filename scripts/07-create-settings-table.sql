-- Crear tabla de configuración
CREATE TABLE IF NOT EXISTS settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT,
  description TEXT,
  data_type VARCHAR(20) DEFAULT 'string' CHECK (data_type IN ('string', 'number', 'boolean', 'json')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Políticas para configuración (todos los usuarios autenticados pueden ver y modificar)
CREATE POLICY "Users can view settings" ON settings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert settings" ON settings FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update settings" ON settings FOR UPDATE USING (auth.role() = 'authenticated');

-- Insertar configuraciones por defecto
INSERT INTO settings (key, value, description, data_type) VALUES
('tax_enabled', 'true', 'Habilitar cálculo de IVA', 'boolean'),
('tax_rate', '16', 'Porcentaje de IVA (%)', 'number'),
('business_name', 'Taller de Bicicletas', 'Nombre del negocio', 'string'),
('business_address', '', 'Dirección del negocio', 'string'),
('business_phone', '', 'Teléfono del negocio', 'string'),
('business_email', '', 'Email del negocio', 'string'),
('currency', 'MXN', 'Moneda', 'string'),
('currency_symbol', '$', 'Símbolo de moneda', 'string'),
('low_stock_threshold', '5', 'Umbral de stock bajo', 'number'),
('quote_validity_days', '7', 'Días de validez por defecto para cotizaciones', 'number')
ON CONFLICT (key) DO NOTHING;

-- Función para actualizar timestamp
CREATE OR REPLACE FUNCTION update_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar timestamp
CREATE TRIGGER trigger_update_settings_timestamp
  BEFORE UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION update_settings_timestamp();
