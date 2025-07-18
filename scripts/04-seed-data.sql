-- Insertar productos de ejemplo
INSERT INTO products (name, description, barcode, price, cost, category, brand, stock_quantity, min_stock) VALUES
('Bicicleta MTB 29"', 'Bicicleta de montaña aro 29 con suspensión delantera', '7891234567890', 1200.00, 800.00, 'Bicicletas', 'Trek', 5, 2),
('Casco de Ciclismo', 'Casco de seguridad para ciclismo urbano', '7891234567891', 150.00, 80.00, 'Accesorios', 'Specialized', 15, 5),
('Cadena de Bicicleta', 'Cadena 10 velocidades', '7891234567892', 45.00, 25.00, 'Repuestos', 'Shimano', 20, 10),
('Llanta 26"', 'Llanta para bicicleta aro 26', '7891234567893', 80.00, 45.00, 'Repuestos', 'Mavic', 12, 5),
('Pedales MTB', 'Pedales para bicicleta de montaña', '7891234567894', 120.00, 70.00, 'Repuestos', 'Shimano', 8, 3),
('Luz LED Delantera', 'Luz LED recargable para bicicleta', '7891234567895', 60.00, 35.00, 'Accesorios', 'Cateye', 25, 10),
('Bomba de Aire', 'Bomba de aire portátil con manómetro', '7891234567896', 35.00, 20.00, 'Herramientas', 'Topeak', 10, 5),
('Kit de Parches', 'Kit de reparación para cámaras', '7891234567897', 15.00, 8.00, 'Herramientas', 'Park Tool', 30, 15);

-- Insertar clientes de ejemplo
INSERT INTO customers (name, email, phone, address) VALUES
('Juan Pérez', 'juan.perez@email.com', '+1234567890', 'Av. Principal 123, Ciudad'),
('María García', 'maria.garcia@email.com', '+1234567891', 'Calle Secundaria 456, Ciudad'),
('Carlos López', 'carlos.lopez@email.com', '+1234567892', 'Plaza Central 789, Ciudad');
