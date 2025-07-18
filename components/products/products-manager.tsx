"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Plus,
  Edit,
  Trash2,
  Search,
  AlertTriangle,
  Package,
  Settings,
  Download,
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  EyeOff,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"

interface ProductVariant {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  public_price: number
  wholesale_price: number
  stock_quantity: number
  min_stock: number
  is_active: boolean
}

interface Product {
  id: string
  name: string
  description: string
  barcode: string
  sku: string | null
  price: number // Mantenemos para compatibilidad
  cost: number
  public_price: number
  wholesale_price: number
  category: string
  brand: string
  stock_quantity: number
  min_stock: number
  has_variants: boolean
  is_active: boolean // Added is_active property
  variants?: ProductVariant[]
}

interface ImportResult {
  success: number
  errors: string[]
  warnings: string[]
}

interface CSVRow {
  [key: string]: string
}

export default function ProductsManager() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [selectedBrand, setBrand] = useState("")
  const [categories, setCategories] = useState<string[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isVariantsDialogOpen, setIsVariantsDialogOpen] = useState(false)
  const [selectedProductForVariants, setSelectedProductForVariants] = useState<Product | null>(null)
  const [variants, setVariants] = useState<ProductVariant[]>([])

  // Import/Export states
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importProgress, setImportProgress] = useState(0)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Category management states
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    barcode: "",
    sku: "",
    public_price: "",
    wholesale_price: "",
    category: "",
    brand: "",
    stock_quantity: "",
    min_stock: "",
    has_variants: false,
  })

  // Estado para nueva variante
  const [newVariant, setNewVariant] = useState({
    name: "",
    sku: "",
    barcode: "",
    public_price: "",
    wholesale_price: "",
    stock_quantity: "",
    min_stock: "",
  })

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase.from("products").select("*").order("name")

      if (error) throw error

      // Para cada producto, obtener sus variantes si las tiene
      const productsWithVariants = await Promise.all(
        (data || []).map(async (product) => {
          if (product.has_variants) {
            const { data: variantsData } = await supabase
              .from("product_variants")
              .select("*")
              .eq("product_id", product.id)
              .order("name")

            return {
              ...product,
              variants: variantsData || [],
            }
          }
          return product
        }),
      )

      setProducts(productsWithVariants)
      getFiltersData(productsWithVariants)
    } catch (error) {
      console.error("Error fetching products:", error)
    } finally {
      setLoading(false)
    }
  }

  const getFiltersData = (products: Product[]) => {
    const uniqueCategories = [...new Set(products.map((p) => p.category).filter(Boolean))]
    const uniqueBrands = [...new Set(products.map((p) => p.brand).filter(Boolean))]
    setCategories(uniqueCategories.sort())
    setBrands(uniqueBrands.sort())
  }

  // CSV Export functionality - Formato simplificado
  const exportToCSV = () => {
    const csvData: any[] = []

    products.forEach((product) => {
      if (product.has_variants && product.variants && product.variants.length > 0) {
        // Producto principal con variantes
        csvData.push({
          nombre: product.name,
          sku: product.sku || "",
          codigo_barras: product.barcode || "",
          precio_publico: product.public_price || product.price || 0,
          precio_puesto: product.wholesale_price || 0,
          categoria: product.category || "",
          marca: product.brand || "",
          tiene_variantes: "SI",
          variante_nombre: "",
          variante_sku: "",
          variante_codigo_barras: "",
          variante_precio_publico: "",
          variante_precio_puesto: "",
          variante_stock: "",
          variante_stock_minimo: "",
          stock: product.stock_quantity,
          stock_minimo: product.min_stock,
          descripcion: product.description || "",
        })

        // Agregar cada variante como fila separada
        product.variants.forEach((variant) => {
          csvData.push({
            nombre: "",
            sku: "",
            codigo_barras: "",
            precio_publico: "",
            precio_puesto: "",
            categoria: "",
            marca: "",
            tiene_variantes: "",
            variante_nombre: variant.name,
            variante_sku: variant.sku || "",
            variante_codigo_barras: variant.barcode || "",
            variante_precio_publico: variant.public_price,
            variante_precio_puesto: variant.wholesale_price,
            variante_stock: variant.stock_quantity,
            variante_stock_minimo: variant.min_stock,
            stock: "",
            stock_minimo: "",
            descripcion: "",
          })
        })
      } else {
        // Producto simple sin variantes
        csvData.push({
          nombre: product.name,
          sku: product.sku || "",
          codigo_barras: product.barcode || "",
          precio_publico: product.public_price || product.price || 0,
          precio_puesto: product.wholesale_price || 0,
          categoria: product.category || "",
          marca: product.brand || "",
          tiene_variantes: "NO",
          variante_nombre: "",
          variante_sku: "",
          variante_codigo_barras: "",
          variante_precio_publico: "",
          variante_precio_puesto: "",
          variante_stock: "",
          variante_stock_minimo: "",
          stock: product.stock_quantity,
          stock_minimo: product.min_stock,
          descripcion: product.description || "",
        })
      }
    })

    const headers = [
      "nombre",
      "sku",
      "codigo_barras",
      "precio_publico",
      "precio_puesto",
      "categoria",
      "marca",
      "tiene_variantes",
      "variante_nombre",
      "variante_sku",
      "variante_codigo_barras",
      "variante_precio_publico",
      "variante_precio_puesto",
      "variante_stock",
      "variante_stock_minimo",
      "stock",
      "stock_minimo",
      "descripcion",
    ]

    const csvContent = [
      headers.join(","),
      ...csvData.map((row) =>
        headers
          .map((header) => {
            const value = row[header]?.toString() || ""
            // Escape commas and quotes in CSV
            return value.includes(",") || value.includes('"') ? `"${value.replace(/"/g, '""')}"` : value
          })
          .join(","),
      ),
    ].join("\n")

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `productos_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Download CSV template - Plantilla simplificada
  const downloadTemplate = () => {
    const templateData = [
      {
        nombre: "Bicicleta Mountain Bike",
        sku: "MTB-001",
        codigo_barras: "1234567890123",
        precio_publico: "299.99",
        precio_puesto: "199.99",
        categoria: "Bicicletas",
        marca: "Trek",
        tiene_variantes: "NO",
        variante_nombre: "",
        variante_sku: "",
        variante_codigo_barras: "",
        variante_precio_publico: "",
        variante_precio_puesto: "",
        variante_stock: "",
        variante_stock_minimo: "",
        stock: "10",
        stock_minimo: "2",
        descripcion: "Bicicleta de montaña con suspensión delantera",
      },
      {
        nombre: "Casco de Seguridad",
        sku: "CASCO-001",
        codigo_barras: "1234567890124",
        precio_publico: "49.99",
        precio_puesto: "29.99",
        categoria: "Accesorios",
        marca: "Bell",
        tiene_variantes: "SI",
        variante_nombre: "",
        variante_sku: "",
        variante_codigo_barras: "",
        variante_precio_publico: "",
        variante_precio_puesto: "",
        variante_stock: "",
        variante_stock_minimo: "",
        stock: "0",
        stock_minimo: "3",
        descripcion: "Casco de seguridad para ciclismo con ventilación",
      },
      {
        nombre: "",
        sku: "",
        codigo_barras: "",
        precio_publico: "",
        precio_puesto: "",
        categoria: "",
        marca: "",
        tiene_variantes: "",
        variante_nombre: "Talla M",
        variante_sku: "CASCO-M",
        variante_codigo_barras: "1234567890125",
        variante_precio_publico: "49.99",
        variante_precio_puesto: "29.99",
        variante_stock: "8",
        variante_stock_minimo: "2",
        stock: "",
        stock_minimo: "",
        descripcion: "",
      },
      {
        nombre: "",
        sku: "",
        codigo_barras: "",
        precio_publico: "",
        precio_puesto: "",
        categoria: "",
        marca: "",
        tiene_variantes: "",
        variante_nombre: "Talla L",
        variante_sku: "CASCO-L",
        variante_codigo_barras: "1234567890126",
        variante_precio_publico: "54.99",
        variante_precio_puesto: "34.99",
        variante_stock: "7",
        variante_stock_minimo: "1",
        stock: "",
        stock_minimo: "",
        descripcion: "",
      },
    ]

    const headers = [
      "nombre",
      "sku",
      "codigo_barras",
      "precio_publico",
      "precio_puesto",
      "categoria",
      "marca",
      "tiene_variantes",
      "variante_nombre",
      "variante_sku",
      "variante_codigo_barras",
      "variante_precio_publico",
      "variante_precio_puesto",
      "variante_stock",
      "variante_stock_minimo",
      "stock",
      "stock_minimo",
      "descripcion",
    ]

    const csvContent = [
      headers.join(","),
      ...templateData.map((row) =>
        headers
          .map((header) => {
            const value = row[header as keyof typeof row]?.toString() || ""
            return value.includes(",") || value.includes('"') ? `"${value.replace(/"/g, '""')}"` : value
          })
          .join(","),
      ),
    ].join("\n")

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", "plantilla_productos.csv")
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Parse CSV file con soporte UTF-8
  const parseCSV = (csvText: string): CSVRow[] => {
    // Remover BOM si existe
    const cleanText = csvText.replace(/^\uFEFF/, "")
    const lines = cleanText.split("\n").filter((line) => line.trim())
    if (lines.length < 2) return []

    const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""))
    const rows: CSVRow[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = []
      let current = ""
      let inQuotes = false

      for (let j = 0; j < lines[i].length; j++) {
        const char = lines[i][j]
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === "," && !inQuotes) {
          values.push(current.trim())
          current = ""
        } else {
          current += char
        }
      }
      values.push(current.trim())

      if (values.length === headers.length) {
        const row: CSVRow = {}
        headers.forEach((header, index) => {
          const value = values[index]?.replace(/"/g, "") || ""
          row[header] = value
        })
        rows.push(row)
      }
    }

    return rows
  }

  // Validate CSV row - Simplificado
  const validateRow = (row: CSVRow, index: number): string[] => {
    const errors: string[] = []

    // Solo validar si es una fila de producto (tiene nombre) o variante (tiene variante_nombre)
    const isProductRow = row.nombre?.trim()
    const isVariantRow = row.variante_nombre?.trim()

    if (!isProductRow && !isVariantRow) {
      return errors // Fila vacía, ignorar
    }

    if (isProductRow) {
      if (!row.nombre?.trim()) {
        errors.push(`Fila ${index + 2}: El nombre del producto es obligatorio`)
      }

      if (row.precio_publico && isNaN(Number(row.precio_publico))) {
        errors.push(`Fila ${index + 2}: Precio público debe ser un número`)
      }

      if (row.precio_puesto && isNaN(Number(row.precio_puesto))) {
        errors.push(`Fila ${index + 2}: Precio puesto debe ser un número`)
      }

      if (row.stock && isNaN(Number(row.stock))) {
        errors.push(`Fila ${index + 2}: Stock debe ser un número`)
      }

      if (row.stock_minimo && isNaN(Number(row.stock_minimo))) {
        errors.push(`Fila ${index + 2}: Stock mínimo debe ser un número`)
      }
    }

    if (isVariantRow) {
      if (row.variante_precio_publico && isNaN(Number(row.variante_precio_publico))) {
        errors.push(`Fila ${index + 2}: Precio público de variante debe ser un número`)
      }

      if (row.variante_precio_puesto && isNaN(Number(row.variante_precio_puesto))) {
        errors.push(`Fila ${index + 2}: Precio puesto de variante debe ser un número`)
      }

      if (row.variante_stock && isNaN(Number(row.variante_stock))) {
        errors.push(`Fila ${index + 2}: Stock de variante debe ser un número`)
      }

      if (row.variante_stock_minimo && isNaN(Number(row.variante_stock_minimo))) {
        errors.push(`Fila ${index + 2}: Stock mínimo de variante debe ser un número`)
      }
    }

    return errors
  }

  // Import CSV data - Simplificado
  const importCSV = async () => {
    if (!importFile) return

    setIsImporting(true)
    setImportProgress(0)
    setImportResult(null)

    try {
      const csvText = await importFile.text()
      const rows = parseCSV(csvText)

      if (rows.length === 0) {
        setImportResult({
          success: 0,
          errors: ["El archivo CSV está vacío o tiene un formato incorrecto"],
          warnings: [],
        })
        return
      }

      const errors: string[] = []
      const warnings: string[] = []
      let successCount = 0

      // Validate all rows first
      rows.forEach((row, index) => {
        const rowErrors = validateRow(row, index)
        errors.push(...rowErrors)
      })

      if (errors.length > 0) {
        setImportResult({ success: 0, errors, warnings })
        return
      }

      // Agrupar filas por producto
      const productGroups: { product: CSVRow; variants: CSVRow[] }[] = []
      let currentProduct: CSVRow | null = null
      let currentVariants: CSVRow[] = []

      for (const row of rows) {
        if (row.nombre?.trim()) {
          // Nueva fila de producto
          if (currentProduct) {
            productGroups.push({ product: currentProduct, variants: currentVariants })
          }
          currentProduct = row
          currentVariants = []
        } else if (row.variante_nombre?.trim() && currentProduct) {
          // Fila de variante
          currentVariants.push(row)
        }
      }

      // Agregar el último grupo
      if (currentProduct) {
        productGroups.push({ product: currentProduct, variants: currentVariants })
      }

      // Process product groups
      for (let i = 0; i < productGroups.length; i++) {
        const { product: row, variants } = productGroups[i]
        setImportProgress((i / productGroups.length) * 100)

        try {
          const hasVariants = row.tiene_variantes?.toLowerCase() === "si" || variants.length > 0

          const productData = {
            name: row.nombre.trim(),
            description: row.descripcion?.trim() || "",
            barcode: row.codigo_barras?.trim() || null,
            sku: row.sku?.trim() || null,
            price: Number(row.precio_publico) || 0,
            cost: Number(row.precio_puesto) * 0.8 || 0,
            public_price: Number(row.precio_publico) || 0,
            wholesale_price: Number(row.precio_puesto) || 0,
            category: row.categoria?.trim() || "",
            brand: row.marca?.trim() || "",
            stock_quantity: hasVariants ? 0 : Number(row.stock) || 0,
            min_stock: Number(row.stock_minimo) || 0,
            has_variants: hasVariants,
          }

          // Buscar producto existente SOLO si tiene código de barras o SKU únicos
          let existingProduct = null

          if (row.codigo_barras?.trim()) {
            const { data } = await supabase
              .from("products")
              .select("*")
              .eq("barcode", row.codigo_barras.trim())
              .maybeSingle()
            existingProduct = data
          }

          if (!existingProduct && row.sku?.trim()) {
            const { data } = await supabase.from("products").select("*").eq("sku", row.sku.trim()).maybeSingle()
            existingProduct = data
          }

          let productId: string

          if (existingProduct) {
            // Update existing product
            const { error } = await supabase.from("products").update(productData).eq("id", existingProduct.id)

            if (error) throw error
            productId = existingProduct.id
            warnings.push(`Producto actualizado: ${row.nombre}`)
          } else {
            // Create new product
            const { data, error } = await supabase.from("products").insert([productData]).select().single()

            if (error) throw error
            productId = data.id
            warnings.push(`Producto creado: ${row.nombre}`)
          }

          // Process variants if any
          for (const variant of variants) {
            const variantData = {
              product_id: productId,
              name: variant.variante_nombre.trim(),
              sku: variant.variante_sku?.trim() || null,
              barcode: variant.variante_codigo_barras?.trim() || null,
              public_price: Number(variant.variante_precio_publico) || 0,
              wholesale_price: Number(variant.variante_precio_puesto) || 0,
              stock_quantity: Number(variant.variante_stock) || 0,
              min_stock: Number(variant.variante_stock_minimo) || 0,
            }

            // Check if variant exists SOLO por código único
            let existingVariant = null
            if (variant.variante_codigo_barras?.trim()) {
              const { data } = await supabase
                .from("product_variants")
                .select("*")
                .eq("barcode", variant.variante_codigo_barras.trim())
                .maybeSingle()
              existingVariant = data
            }

            if (!existingVariant && variant.variante_sku?.trim()) {
              const { data } = await supabase
                .from("product_variants")
                .select("*")
                .eq("sku", variant.variante_sku.trim())
                .maybeSingle()
              existingVariant = data
            }

            if (existingVariant) {
              const { error } = await supabase.from("product_variants").update(variantData).eq("id", existingVariant.id)
              if (error) throw error
              warnings.push(`Variante actualizada: ${variant.variante_nombre}`)
            } else {
              const { error } = await supabase.from("product_variants").insert([variantData])
              if (error) throw error
              warnings.push(`Variante creada: ${variant.variante_nombre}`)
            }
          }

          successCount++
        } catch (error) {
          errors.push(
            `Error en producto ${row.nombre}: ${error instanceof Error ? error.message : "Error desconocido"}`,
          )
        }
      }

      setImportProgress(100)
      setImportResult({ success: successCount, errors, warnings })

      if (successCount > 0) {
        await fetchProducts()
      }
    } catch (error) {
      setImportResult({
        success: 0,
        errors: [`Error al procesar el archivo: ${error instanceof Error ? error.message : "Error desconocido"}`],
        warnings: [],
      })
    } finally {
      setIsImporting(false)
    }
  }

  // Handle new category creation
  const handleAddNewCategory = () => {
    if (newCategoryName.trim()) {
      setFormData({ ...formData, category: newCategoryName.trim() })
      setCategories((prev) => [...prev, newCategoryName.trim()].sort())
      setNewCategoryName("")
      setIsAddingNewCategory(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const productData = {
      name: formData.name,
      description: formData.description,
      barcode: formData.barcode || null,
      sku: formData.sku || null,
      price: Number.parseFloat(formData.public_price), // Mantener para compatibilidad
      cost: Number.parseFloat(formData.wholesale_price) * 0.8, // Estimación del costo
      public_price: Number.parseFloat(formData.public_price),
      wholesale_price: Number.parseFloat(formData.wholesale_price),
      category: formData.category,
      brand: formData.brand,
      stock_quantity: formData.has_variants ? 0 : Number.parseInt(formData.stock_quantity),
      min_stock: Number.parseInt(formData.min_stock),
      has_variants: formData.has_variants,
      is_active: true, // New products are active by default
    }

    try {
      if (editingProduct) {
        const { error } = await supabase.from("products").update(productData).eq("id", editingProduct.id)

        if (error) throw error
      } else {
        const { error } = await supabase.from("products").insert([productData])

        if (error) throw error
      }

      await fetchProducts()
      resetForm()
      setIsDialogOpen(false)
    } catch (error) {
      console.error("Error saving product:", error)
    }
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      description: product.description || "",
      barcode: product.barcode || "",
      sku: product.sku || "",
      public_price: product.public_price?.toString() || product.price?.toString() || "",
      wholesale_price: product.wholesale_price?.toString() || "",
      category: product.category || "",
      brand: product.brand || "",
      stock_quantity: product.stock_quantity.toString(),
      min_stock: product.min_stock.toString(),
      has_variants: product.has_variants || false,
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string, productName: string) => {
    try {
      // Always attempt to deactivate the product
      const { error: deactivateError } = await supabase.from("products").update({ is_active: false }).eq("id", id)

      if (deactivateError) {
        throw deactivateError
      }

      await fetchProducts()
      alert(`Producto "${productName}" ha sido desactivado.`)
    } catch (error) {
      console.error("Error deactivating product:", error)
      alert(
        `Error al desactivar el producto "${productName}": ${error instanceof Error ? error.message : "Error desconocido"}`,
      )
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      barcode: "",
      sku: "",
      public_price: "",
      wholesale_price: "",
      category: "",
      brand: "",
      stock_quantity: "",
      min_stock: "",
      has_variants: false,
    })
    setEditingProduct(null)
    setIsAddingNewCategory(false)
    setNewCategoryName("")
  }

  const handleManageVariants = async (product: Product) => {
    setSelectedProductForVariants(product)

    // Cargar variantes del producto
    try {
      const { data, error } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", product.id)
        .order("name")

      if (error) throw error
      setVariants(data || [])
      setIsVariantsDialogOpen(true)
    } catch (error) {
      console.error("Error fetching variants:", error)
    }
  }

  const handleAddVariant = async () => {
    if (!selectedProductForVariants || !newVariant.name) return

    try {
      const variantData = {
        product_id: selectedProductForVariants.id,
        name: newVariant.name,
        sku: newVariant.sku || null,
        barcode: newVariant.barcode || null,
        public_price: Number.parseFloat(newVariant.public_price),
        wholesale_price: Number.parseFloat(newVariant.wholesale_price),
        stock_quantity: Number.parseInt(newVariant.stock_quantity),
        min_stock: Number.parseInt(newVariant.min_stock),
        is_active: true, // New variants are active by default
      }

      const { error } = await supabase.from("product_variants").insert([variantData])

      if (error) throw error

      // Recargar variantes
      const { data } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", selectedProductForVariants.id)
        .order("name")

      setVariants(data || [])

      // Limpiar formulario de nueva variante
      setNewVariant({
        name: "",
        sku: "",
        barcode: "",
        public_price: "",
        wholesale_price: "",
        stock_quantity: "",
        min_stock: "",
      })

      // Actualizar productos
      await fetchProducts()
    } catch (error) {
      console.error("Error adding variant:", error)
    }
  }

  const handleDeleteVariant = async (variantId: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar esta variante?")) return

    try {
      const { error } = await supabase.from("product_variants").delete().eq("id", variantId)

      if (error) throw error

      // Recargar variantes
      const { data } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", selectedProductForVariants!.id)
        .order("name")

      setVariants(data || [])
      await fetchProducts()
    } catch (error) {
      console.error("Error deleting variant:", error)
    }
  }

  const clearFilters = () => {
    setSearchTerm("")
    setSelectedCategory("all")
    setBrand("all")
  }

  const filteredProducts = products.filter((product) => {
    // Only show active products by default
    if (product.is_active === false) return false

    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.barcode && product.barcode.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (product.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesCategory = !selectedCategory || selectedCategory === "all" || product.category === selectedCategory
    const matchesBrand = !selectedBrand || selectedBrand === "all" || product.brand === selectedBrand

    return matchesSearch && matchesCategory && matchesBrand
  })

  const lowStockProducts = products.filter((product) => {
    if (product.is_active === false) return false // Only consider active products for low stock alert
    if (product.has_variants) {
      return product.variants?.some((variant) => variant.stock_quantity <= variant.min_stock)
    }
    return product.stock_quantity <= product.min_stock
  })

  if (loading) {
    return <div className="flex justify-center items-center h-64">Cargando productos...</div>
  }

  return (
    <div className="space-y-6 p-2 md:p-6">
      {/* Alerta de stock bajo */}
      {lowStockProducts.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center text-orange-800">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Productos con Stock Bajo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lowStockProducts.map((product) => (
                <div key={product.id} className="flex justify-between items-center">
                  <span className="text-sm">{product.name}</span>
                  <Badge variant="destructive">
                    Stock:{" "}
                    {product.has_variants
                      ? product.variants?.reduce((sum, v) => sum + v.stock_quantity, 0)
                      : product.stock_quantity}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header con filtros y botones */}
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            {/* Búsqueda */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar por nombre, marca, código o SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="w-full sm:w-48">
                <Select
                  value={selectedCategory || "all"}
                  onValueChange={(value) => setSelectedCategory(value === "all" ? "" : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las categorías" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las categorías</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full sm:w-48">
                <Select
                  value={selectedBrand || "all"}
                  onValueChange={(value) => setBrand(value === "all" ? "" : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las marcas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las marcas</SelectItem>
                    {brands.map((brand) => (
                      <SelectItem key={brand} value={brand}>
                        {brand}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(searchTerm || selectedCategory || selectedBrand) && (
                <Button variant="outline" onClick={clearFilters} className="whitespace-nowrap bg-transparent">
                  Limpiar Filtros
                </Button>
              )}
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex flex-wrap gap-2">
            {/* Botón exportar */}
            <Button variant="outline" onClick={exportToCSV} className="whitespace-nowrap bg-transparent">
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>

            {/* Botón importar */}
            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="whitespace-nowrap bg-transparent">
                  <Upload className="h-4 w-4 mr-2" />
                  Importar CSV
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Importar Productos desde CSV</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Template download */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">Descargar Plantilla</h4>
                      <p className="text-sm text-gray-500">
                        Descarga una plantilla CSV con el formato correcto y ejemplos
                      </p>
                    </div>
                    <Button variant="outline" onClick={downloadTemplate}>
                      <FileText className="h-4 w-4 mr-2" />
                      Descargar
                    </Button>
                  </div>

                  {/* Instrucciones */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-medium text-blue-800 mb-2">Formato CSV Simplificado:</h4>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>
                        • <strong>Campos obligatorios:</strong> nombre, precio_publico, precio_puesto
                      </li>
                      <li>
                        • <strong>Campos opcionales:</strong> sku, codigo_barras, categoria, marca, descripcion
                      </li>
                      <li>
                        • <strong>Para variantes:</strong> usa "SI" en tiene_variantes y agrega filas de variantes
                      </li>
                      <li>
                        • <strong>Codificación:</strong> Guarda el archivo con codificación UTF-8
                      </li>
                      <li>• Solo se actualizarán productos con código de barras o SKU únicos</li>
                    </ul>
                  </div>

                  {/* File upload */}
                  <div className="space-y-2">
                    <Label htmlFor="csv-file">Seleccionar archivo CSV</Label>
                    <Input
                      id="csv-file"
                      type="file"
                      accept=".csv"
                      ref={fileInputRef}
                      onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    />
                  </div>

                  {/* Import progress */}
                  {isImporting && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Importando...</span>
                        <span>{Math.round(importProgress)}%</span>
                      </div>
                      <Progress value={importProgress} />
                    </div>
                  )}

                  {/* Import results */}
                  {importResult && (
                    <div className="space-y-2">
                      <Alert
                        className={
                          importResult.errors.length > 0 ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"
                        }
                      >
                        <div className="flex items-center">
                          {importResult.errors.length > 0 ? (
                            <XCircle className="h-4 w-4 text-red-600" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          )}
                          <AlertDescription className="ml-2">
                            {importResult.success > 0 && (
                              <div className="text-green-700">
                                ✓ {importResult.success} productos procesados exitosamente
                              </div>
                            )}
                            {importResult.warnings.length > 0 && (
                              <div className="text-yellow-700 mt-1">
                                <strong>Detalles:</strong>
                                <ul className="list-disc list-inside mt-1 max-h-32 overflow-y-auto">
                                  {importResult.warnings.map((warning, i) => (
                                    <li key={i} className="text-sm">
                                      {warning}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {importResult.errors.length > 0 && (
                              <div className="text-red-700 mt-1">
                                <strong>Errores:</strong>
                                <ul className="list-disc list-inside mt-1 max-h-32 overflow-y-auto">
                                  {importResult.errors.map((error, i) => (
                                    <li key={i} className="text-sm">
                                      {error}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </AlertDescription>
                        </div>
                      </Alert>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsImportDialogOpen(false)
                        setImportFile(null)
                        setImportResult(null)
                        setImportProgress(0)
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button onClick={importCSV} disabled={!importFile || isImporting}>
                      {isImporting ? "Importando..." : "Importar"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Botón agregar producto */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm} className="whitespace-nowrap">
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Producto
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingProduct ? "Editar Producto" : "Agregar Producto"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nombre *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sku">SKU</Label>
                      <Input
                        id="sku"
                        value={formData.sku}
                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                        placeholder="Código único del producto"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="barcode">Código de Barras</Label>
                      <Input
                        id="barcode"
                        value={formData.barcode}
                        onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="public_price">Precio Público *</Label>
                      <Input
                        id="public_price"
                        type="number"
                        step="0.01"
                        value={formData.public_price}
                        onChange={(e) => setFormData({ ...formData, public_price: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="wholesale_price">Precio Puesto *</Label>
                      <Input
                        id="wholesale_price"
                        type="number"
                        step="0.01"
                        value={formData.wholesale_price}
                        onChange={(e) => setFormData({ ...formData, wholesale_price: e.target.value })}
                        required
                      />
                    </div>

                    {/* Categoría mejorada */}
                    <div className="space-y-2">
                      <Label htmlFor="category">Categoría</Label>
                      {!isAddingNewCategory ? (
                        <div className="flex gap-2">
                          <Select
                            value={formData.category}
                            onValueChange={(value) => {
                              if (value === "add_new") {
                                setIsAddingNewCategory(true)
                              } else {
                                setFormData({ ...formData, category: value })
                              }
                            }}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Seleccionar categoría" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map((category) => (
                                <SelectItem key={category} value={category}>
                                  {category}
                                </SelectItem>
                              ))}
                              <SelectItem value="add_new" className="text-blue-600 font-medium">
                                + Agregar nueva categoría
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Input
                            placeholder="Nombre de la nueva categoría"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault()
                                handleAddNewCategory()
                              }
                            }}
                          />
                          <Button
                            type="button"
                            onClick={handleAddNewCategory}
                            disabled={!newCategoryName.trim()}
                            size="sm"
                          >
                            Agregar
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setIsAddingNewCategory(false)
                              setNewCategoryName("")
                            }}
                            size="sm"
                          >
                            Cancelar
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="brand">Marca</Label>
                      <Input
                        id="brand"
                        value={formData.brand}
                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      />
                    </div>

                    {/* Switch para variantes */}
                    <div className="col-span-2 space-y-2">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="has_variants"
                          checked={formData.has_variants}
                          onCheckedChange={(checked) => setFormData({ ...formData, has_variants: checked })}
                        />
                        <Label htmlFor="has_variants">Este producto tiene variantes</Label>
                      </div>
                      <p className="text-sm text-gray-500">
                        Si activas esta opción, podrás crear variantes del producto (tallas, colores, etc.)
                      </p>
                    </div>

                    {!formData.has_variants && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="stock_quantity">Cantidad en Stock *</Label>
                          <Input
                            id="stock_quantity"
                            type="number"
                            value={formData.stock_quantity}
                            onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="min_stock">Stock Mínimo *</Label>
                          <Input
                            id="min_stock"
                            type="number"
                            value={formData.min_stock}
                            onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                            required
                          />
                        </div>
                      </>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Descripción</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">{editingProduct ? "Actualizar" : "Guardar"}</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Contador de resultados */}
        <div className="flex justify-between items-center text-sm text-gray-600">
          <span>
            Mostrando {filteredProducts.length} de {products.length} productos
            {selectedCategory && ` • Categoría: ${selectedCategory}`}
            {selectedBrand && ` • Marca: ${selectedBrand}`}
          </span>
        </div>
      </div>

      {/* Tabla de productos */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden sm:table-cell">SKU</TableHead>
                  <TableHead className="hidden sm:table-cell">Marca</TableHead>
                  <TableHead className="hidden md:table-cell">Categoría</TableHead>
                  <TableHead>Precio Público</TableHead>
                  <TableHead className="hidden lg:table-cell">Precio Puesto</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {product.name}
                          {product.has_variants && (
                            <Badge variant="outline" className="text-xs">
                              <Package className="h-3 w-3 mr-1" />
                              Variantes
                            </Badge>
                          )}
                          {product.is_active === false && (
                            <Badge variant="secondary" className="text-xs">
                              <EyeOff className="h-3 w-3 mr-1" />
                              Inactivo
                            </Badge>
                          )}
                        </div>
                        {product.barcode && <div className="text-sm text-gray-500">{product.barcode}</div>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="font-mono text-sm">{product.sku || "-"}</span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{product.brand}</TableCell>
                    <TableCell className="hidden md:table-cell">{product.category}</TableCell>
                    <TableCell>${(product.public_price || product.price || 0).toFixed(2)}</TableCell>
                    <TableCell className="hidden lg:table-cell">${(product.wholesale_price || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          (
                            product.has_variants
                              ? product.variants?.some((v) => v.stock_quantity <= v.min_stock)
                              : product.stock_quantity <= product.min_stock
                          )
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {product.has_variants
                          ? product.variants?.reduce((sum, v) => sum + v.stock_quantity, 0) || 0
                          : product.stock_quantity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        {product.has_variants && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleManageVariants(product)}
                            title="Gestionar variantes"
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(product)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(product.id, product.name)}
                          title="Eliminar producto"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Diálogo para gestionar variantes */}
      <Dialog open={isVariantsDialogOpen} onOpenChange={setIsVariantsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gestionar Variantes - {selectedProductForVariants?.name}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="variants" className="space-y-4">
            <TabsList>
              <TabsTrigger value="variants">Variantes</TabsTrigger>
              <TabsTrigger value="add">Agregar Variante</TabsTrigger>
            </TabsList>

            <TabsContent value="variants" className="space-y-4">
              {variants.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Código de Barras</TableHead>
                        <TableHead>Precio Público</TableHead>
                        <TableHead>Precio Puesto</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {variants.map((variant) => (
                        <TableRow key={variant.id}>
                          <TableCell>{variant.name}</TableCell>
                          <TableCell>
                            <span className="font-mono text-sm">{variant.sku || "-"}</span>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm">{variant.barcode || "-"}</span>
                          </TableCell>
                          <TableCell>${variant.public_price.toFixed(2)}</TableCell>
                          <TableCell>${variant.wholesale_price.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant={variant.stock_quantity <= variant.min_stock ? "destructive" : "secondary"}>
                              {variant.stock_quantity}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteVariant(variant.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">No hay variantes creadas para este producto</div>
              )}
            </TabsContent>

            <TabsContent value="add" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="variant_name">Nombre de la Variante *</Label>
                  <Input
                    id="variant_name"
                    placeholder="Ej: Talla M, Color Rojo"
                    value={newVariant.name}
                    onChange={(e) => setNewVariant({ ...newVariant, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="variant_sku">SKU</Label>
                  <Input
                    id="variant_sku"
                    placeholder="Código único"
                    value={newVariant.sku}
                    onChange={(e) => setNewVariant({ ...newVariant, sku: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="variant_barcode">Código de Barras</Label>
                  <Input
                    id="variant_barcode"
                    value={newVariant.barcode}
                    onChange={(e) => setNewVariant({ ...newVariant, barcode: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="variant_public_price">Precio Público *</Label>
                  <Input
                    id="variant_public_price"
                    type="number"
                    step="0.01"
                    value={newVariant.public_price}
                    onChange={(e) => setNewVariant({ ...newVariant, public_price: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="variant_wholesale_price">Precio Puesto *</Label>
                  <Input
                    id="variant_wholesale_price"
                    type="number"
                    step="0.01"
                    value={newVariant.wholesale_price}
                    onChange={(e) => setNewVariant({ ...newVariant, wholesale_price: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="variant_stock">Stock Inicial *</Label>
                  <Input
                    id="variant_stock"
                    type="number"
                    value={newVariant.stock_quantity}
                    onChange={(e) => setNewVariant({ ...newVariant, stock_quantity: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="variant_min_stock">Stock Mínimo *</Label>
                  <Input
                    id="variant_min_stock"
                    type="number"
                    value={newVariant.min_stock}
                    onChange={(e) => setNewVariant({ ...newVariant, min_stock: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleAddVariant} disabled={!newVariant.name}>
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Variante
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  )
}
