"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Edit, Trash2, Search, Users, Percent, Mail, Phone, Eye } from "lucide-react"
import { Badge } from "@/components/ui/badge"

// Agregar la importación del componente de detalle
import CustomerDetail from "./customer-detail"

interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  discount_percentage: number
  created_at: string
}

export default function CustomersManager() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    discount_percentage: "",
  })

  // Agregar estado para el diálogo de detalle
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase.from("customers").select("*").order("name")

      if (error) throw error
      setCustomers(data || [])
    } catch (error) {
      console.error("Error fetching customers:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const customerData = {
      name: formData.name,
      email: formData.email || null,
      phone: formData.phone || null,
      address: formData.address || null,
      discount_percentage: formData.discount_percentage ? Number.parseFloat(formData.discount_percentage) : 0,
    }

    try {
      if (editingCustomer) {
        const { error } = await supabase.from("customers").update(customerData).eq("id", editingCustomer.id)

        if (error) throw error
      } else {
        const { error } = await supabase.from("customers").insert([customerData])

        if (error) throw error
      }

      await fetchCustomers()
      resetForm()
      setIsDialogOpen(false)
    } catch (error) {
      console.error("Error saving customer:", error)
      alert("Error al guardar el cliente")
    }
  }

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer)
    setFormData({
      name: customer.name,
      email: customer.email || "",
      phone: customer.phone || "",
      address: customer.address || "",
      discount_percentage: customer.discount_percentage.toString(),
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm("¿Estás seguro de que quieres eliminar este cliente?")) {
      try {
        const { error } = await supabase.from("customers").delete().eq("id", id)

        if (error) throw error
        await fetchCustomers()
      } catch (error) {
        console.error("Error deleting customer:", error)
        alert("Error al eliminar el cliente")
      }
    }
  }

  // Agregar función para ver detalle del cliente
  const handleViewCustomer = (customer: Customer) => {
    setSelectedCustomer(customer)
    setIsDetailDialogOpen(true)
  }

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      address: "",
      discount_percentage: "",
    })
    setEditingCustomer(null)
  }

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (customer.phone && customer.phone.includes(searchTerm)),
  )

  const customersWithDiscount = customers.filter((customer) => customer.discount_percentage > 0)
  const totalCustomers = customers.length

  if (loading) {
    return <div className="flex justify-center items-center h-64">Cargando clientes...</div>
  }

  return (
    <div className="space-y-6">
      {/* Resumen de clientes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCustomers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Con Descuento</CardTitle>
            <Percent className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{customersWithDiscount.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nuevos Este Mes</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {
                customers.filter((c) => {
                  const customerDate = new Date(c.created_at)
                  const now = new Date()
                  return customerDate.getMonth() === now.getMonth() && customerDate.getFullYear() === now.getFullYear()
                }).length
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header con búsqueda y botón agregar */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Buscar clientes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Agregar Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingCustomer ? "Editar Cliente" : "Agregar Cliente"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre Completo *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1234567890"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="cliente@email.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discount_percentage">Porcentaje de Descuento (%)</Label>
                  <Input
                    id="discount_percentage"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formData.discount_percentage}
                    onChange={(e) => setFormData({ ...formData, discount_percentage: e.target.value })}
                    placeholder="0"
                  />
                  <p className="text-sm text-gray-500">Descuento especial para este cliente (0-100%)</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Dirección</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={3}
                  placeholder="Dirección completa del cliente"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">{editingCustomer ? "Actualizar" : "Guardar"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Contador de resultados */}
      <div className="flex justify-between items-center text-sm text-gray-600">
        <span>
          Mostrando {filteredCustomers.length} de {customers.length} clientes
        </span>
      </div>

      {/* Tabla de clientes */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden sm:table-cell">Contacto</TableHead>
                  <TableHead className="hidden md:table-cell">Dirección</TableHead>
                  <TableHead>Descuento</TableHead>
                  <TableHead className="hidden lg:table-cell">Fecha Registro</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <div className="font-medium">{customer.name}</div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="space-y-1">
                        {customer.email && (
                          <div className="flex items-center text-sm text-gray-600">
                            <Mail className="h-3 w-3 mr-1" />
                            {customer.email}
                          </div>
                        )}
                        {customer.phone && (
                          <div className="flex items-center text-sm text-gray-600">
                            <Phone className="h-3 w-3 mr-1" />
                            {customer.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="max-w-xs truncate" title={customer.address || ""}>
                        {customer.address || "No especificada"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {customer.discount_percentage > 0 ? (
                        <Badge className="bg-green-100 text-green-800">
                          <Percent className="h-3 w-3 mr-1" />
                          {customer.discount_percentage}%
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Sin descuento</Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {new Date(customer.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => handleViewCustomer(customer)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(customer)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(customer.id)}>
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
      {selectedCustomer && (
        <CustomerDetail
          customer={selectedCustomer}
          isOpen={isDetailDialogOpen}
          onClose={() => setIsDetailDialogOpen(false)}
          onUpdate={fetchCustomers}
        />
      )}
    </div>
  )
}
