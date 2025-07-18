-- Habilitar Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

-- Políticas para productos (todos los usuarios autenticados pueden ver y modificar)
CREATE POLICY "Users can view products" ON products FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert products" ON products FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update products" ON products FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete products" ON products FOR DELETE USING (auth.role() = 'authenticated');

-- Políticas para movimientos de inventario
CREATE POLICY "Users can view inventory movements" ON inventory_movements FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert inventory movements" ON inventory_movements FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Políticas para clientes
CREATE POLICY "Users can view customers" ON customers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert customers" ON customers FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update customers" ON customers FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete customers" ON customers FOR DELETE USING (auth.role() = 'authenticated');

-- Políticas para cotizaciones
CREATE POLICY "Users can view quotes" ON quotes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert quotes" ON quotes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update quotes" ON quotes FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete quotes" ON quotes FOR DELETE USING (auth.role() = 'authenticated');

-- Políticas para items de cotización
CREATE POLICY "Users can view quote items" ON quote_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert quote items" ON quote_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update quote items" ON quote_items FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete quote items" ON quote_items FOR DELETE USING (auth.role() = 'authenticated');

-- Políticas para ventas
CREATE POLICY "Users can view sales" ON sales FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert sales" ON sales FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update sales" ON sales FOR UPDATE USING (auth.role() = 'authenticated');

-- Políticas para items de venta
CREATE POLICY "Users can view sale items" ON sale_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert sale items" ON sale_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
