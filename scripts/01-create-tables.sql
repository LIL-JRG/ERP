-- Crear tabla de productos
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  barcode VARCHAR(100) UNIQUE,
  price DECIMAL(10,2) NOT NULL,
  cost DECIMAL(10,2) NOT NULL,
  category VARCHAR(100),
  brand VARCHAR(100),
  stock_quantity INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla de movimientos de inventario
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  movement_type VARCHAR(20) CHECK (movement_type IN ('entrada', 'salida', 'ajuste')),
  quantity INTEGER NOT NULL,
  reason VARCHAR(255),
  reference_id UUID, -- Para referenciar ventas o compras
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla de clientes
CREATE TABLE IF NOT EXISTS customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla de cotizaciones
CREATE TABLE IF NOT EXISTS quotes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id),
  customer_name VARCHAR(255),
  customer_phone VARCHAR(20),
  customer_email VARCHAR(255),
  subtotal DECIMAL(10,2) NOT NULL,
  tax DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'aprobada', 'rechazada', 'convertida')),
  valid_until DATE,
  notes TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla de items de cotización
CREATE TABLE IF NOT EXISTS quote_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL
);

-- Crear tabla de ventas
CREATE TABLE IF NOT EXISTS sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id),
  customer_name VARCHAR(255),
  subtotal DECIMAL(10,2) NOT NULL,
  tax DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50),
  status VARCHAR(20) DEFAULT 'completada' CHECK (status IN ('completada', 'cancelada', 'pendiente')),
  quote_id UUID REFERENCES quotes(id),
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla de items de venta
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL
);
