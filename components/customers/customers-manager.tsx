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
    return <div className="flex justify-center items-center h-64 text-xl font-black text-slate-400 uppercase tracking-tighter italic">Cargando portafolio...</div>
  }

  return (
    <div className="space-y-12 p-6 md:p-10 max-w-[1600px] mx-auto animate-in fade-in duration-700">
      {/* Massive Big UI Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-4">
        <div>
          <h1 className="text-7xl md:text-8xl font-black tracking-tighter text-slate-900 leading-[0.8] mb-4">
            Clientes<span className="text-emerald-500">.</span>
          </h1>
          <p className="text-xl font-bold text-slate-400 uppercase tracking-widest italic ml-1">
            Gestión de Cartera y Fidelización
          </p>
        </div>
        <div className="flex items-center gap-4">
           <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                onClick={resetForm}
                className="h-16 px-8 rounded-2xl bg-slate-900 text-white font-black uppercase tracking-widest text-xs hover:bg-emerald-500 hover:scale-105 transition-all shadow-xl shadow-slate-900/10"
              >
                <Plus className="h-5 w-5 mr-3" />
                Registrar Titular
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl rounded-[44px] border-none shadow-2xl p-10 overflow-hidden bg-white">
              <DialogHeader className="mb-8">
                <DialogTitle className="text-4xl font-black text-slate-900 tracking-tighter italic">
                  {editingCustomer ? "Actualizar Perfil." : "Nuevo Registro."}
                </DialogTitle>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Información Maestra del Cliente</p>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <Label htmlFor="name" className="ml-1 text-[11px] font-black uppercase tracking-widest text-slate-400">Nombre Completo *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="h-16 rounded-2xl border-none bg-slate-50 font-black text-slate-900 focus-visible:ring-2 focus-visible:ring-emerald-500"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="phone" className="ml-1 text-[11px] font-black uppercase tracking-widest text-slate-400">Teléfono Directo</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+1234567890"
                      className="h-16 rounded-2xl border-none bg-slate-50 font-black text-slate-900 focus-visible:ring-2 focus-visible:ring-emerald-500"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="email" className="ml-1 text-[11px] font-black uppercase tracking-widest text-slate-400">Email Corporativo</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="cliente@email.com"
                      className="h-16 rounded-2xl border-none bg-slate-50 font-black text-slate-900 focus-visible:ring-2 focus-visible:ring-emerald-500"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="discount_percentage" className="ml-1 text-[11px] font-black uppercase tracking-widest text-slate-400">Beneficio Comercial (%)</Label>
                    <Input
                      id="discount_percentage"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={formData.discount_percentage}
                      onChange={(e) => setFormData({ ...formData, discount_percentage: e.target.value })}
                      placeholder="0"
                      className="h-16 rounded-2xl border-none bg-slate-50 font-black text-slate-900 focus-visible:ring-2 focus-visible:ring-emerald-500"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="address" className="ml-1 text-[11px] font-black uppercase tracking-widest text-slate-400">Dirección de Facturación / Entrega</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="rounded-2xl border-none bg-slate-50 font-bold p-6 min-h-[120px] focus-visible:ring-2 focus-visible:ring-emerald-500"
                    placeholder="Especifique la ubicación completa..."
                  />
                </div>
                <div className="flex justify-end gap-4 pt-4">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={() => setIsDialogOpen(false)}
                    className="h-14 px-8 rounded-xl font-black uppercase text-xs tracking-widest text-slate-400"
                  >
                    Descartar
                  </Button>
                  <Button 
                    type="submit"
                    className="h-14 px-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-emerald-500/20"
                  >
                    {editingCustomer ? "Guardar Cambios" : "Crear Registro"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Premium Customer Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-[32px] border-none shadow-sm bg-white p-8 group hover:shadow-xl transition-all duration-500">
          <div className="flex justify-between items-start mb-6">
            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-900 group-hover:scale-110 transition-transform">
              <Users className="h-7 w-7" />
            </div>
            <Badge className="bg-slate-50 text-slate-600 border-none font-black px-3 py-1 rounded-full uppercase text-[10px] tracking-widest italic">Activos</Badge>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Total Clientes</p>
            <h3 className="text-4xl font-black text-slate-900 tracking-tighter italic">
              {totalCustomers} <span className="text-lg text-slate-300">titulares</span>
            </h3>
          </div>
        </Card>

        <Card className="rounded-[32px] border-none shadow-sm bg-white p-8 group hover:shadow-xl transition-all duration-500">
          <div className="flex justify-between items-start mb-6">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
              <Percent className="h-7 w-7" />
            </div>
            <Badge className="bg-emerald-50 text-emerald-600 border-none font-black px-3 py-1 rounded-full uppercase text-[10px] tracking-widest italic">Ofertas</Badge>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Con Desfio/Beneficio</p>
            <h3 className="text-4xl font-black text-emerald-600 tracking-tighter italic">
              {customersWithDiscount.length} <span className="text-lg text-emerald-200 text-slate-300">vip</span>
            </h3>
          </div>
        </Card>

        <Card className="rounded-[32px] border-none shadow-sm bg-white p-8 group hover:shadow-xl transition-all duration-500">
          <div className="flex justify-between items-start mb-6">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
              <Plus className="h-7 w-7" />
            </div>
            <Badge className="bg-blue-50 text-blue-600 border-none font-black px-3 py-1 rounded-full uppercase text-[10px] tracking-widest italic">Crecimiento</Badge>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Nuevos (Mes {new Date().toLocaleString('es', { month: 'short' })})</p>
            <h3 className="text-4xl font-black text-blue-600 tracking-tighter italic">
              {
                customers.filter((c) => {
                  const customerDate = new Date(c.created_at)
                  const now = new Date()
                  return customerDate.getMonth() === now.getMonth() && customerDate.getFullYear() === now.getFullYear()
                }).length
              } <span className="text-lg text-blue-200">altas</span>
            </h3>
          </div>
        </Card>
      </div>

      {/* Header Búsqueda con Estilo Masivo */}
      <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
        <div className="relative w-full md:w-[400px] group">
          <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
            <Search className="h-6 w-6 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
          </div>
          <Input
            placeholder="BUSCAR POR NOMBRE, EMAIL O TEL..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-16 pl-16 rounded-[24px] border-none bg-white shadow-sm font-black text-sm uppercase tracking-widest placeholder:text-slate-300 focus-visible:ring-2 focus-visible:ring-emerald-500 transition-all text-slate-900"
          />
        </div>
        <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] italic pr-4">
           FILTRANDO {filteredCustomers.length} RESULTADOS DE {customers.length}
        </div>
      </div>

      {/* Tabla de Clientes Big UI */}
      <div className="bg-white rounded-[44px] shadow-sm overflow-hidden p-4 border border-slate-50 animate-in slide-in-from-bottom-6 duration-700">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-50 hover:bg-transparent">
                <TableHead className="h-20 px-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">IDENTIDAD / CLIENTE</TableHead>
                <TableHead className="h-20 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] hidden sm:table-cell">CONTACTO DIRECTO</TableHead>
                <TableHead className="h-20 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] hidden md:table-cell">UBICACIÓN GEOGRÁFICA</TableHead>
                <TableHead className="h-20 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">BENEFICIO (%)</TableHead>
                <TableHead className="h-20 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] hidden lg:table-cell">ALTA SISTEMA</TableHead>
                <TableHead className="h-20 px-8 text-right text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">ACCIONES</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-20">
                    <p className="text-2xl font-black text-slate-300 tracking-tighter uppercase italic">Sin registros coincidentes.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer) => (
                  <TableRow key={customer.id} className="group border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <TableCell className="px-8 py-8">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-lg italic shadow-lg shadow-slate-900/10">
                          {customer.name.charAt(0)}
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xl font-black text-slate-900 uppercase tracking-tight">{customer.name}</span>
                          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic leading-none">ID: {customer.id.split('-')[0]}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-8 hidden sm:table-cell">
                      <div className="flex flex-col gap-2">
                        {customer.email && (
                          <div className="flex items-center text-xs font-bold text-slate-500 lowercase tracking-tight">
                            <Mail className="h-3.5 w-3.5 mr-2 text-slate-300" />
                            {customer.email}
                          </div>
                        )}
                        {customer.phone && (
                          <div className="flex items-center text-xs font-black text-slate-900 uppercase tracking-widest">
                            <Phone className="h-3.5 w-3.5 mr-2 text-emerald-500" />
                            {customer.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-8 hidden md:table-cell">
                      <div className="max-w-xs text-xs font-bold text-slate-400 uppercase leading-snug tracking-tight italic" title={customer.address || ""}>
                        {customer.address || "UBICACIÓN SIN DEFINIR"}
                      </div>
                    </TableCell>
                    <TableCell className="py-8">
                      {customer.discount_percentage > 0 ? (
                        <div className="flex flex-col gap-1">
                          <Badge className="bg-emerald-50 text-emerald-600 border-none font-black px-3 py-1 rounded-lg uppercase text-[9px] tracking-widest italic w-fit">
                            VALOR PREFERENCIAL
                          </Badge>
                          <span className="text-2xl font-black text-emerald-600 tracking-tighter italic">-{customer.discount_percentage}%</span>
                        </div>
                      ) : (
                        <Badge className="bg-slate-50 text-slate-400 border-none font-black px-3 py-1 rounded-lg uppercase text-[9px] tracking-widest italic">
                          TARIFA ESTÁNDAR
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-8 hidden lg:table-cell text-xs font-black text-slate-300 uppercase tracking-widest italic">
                      {new Date(customer.created_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </TableCell>
                    <TableCell className="px-8 py-8 text-right">
                      <div className="flex justify-end gap-3">
                        <Button 
                          variant="ghost" 
                          onClick={() => handleViewCustomer(customer)}
                          className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-100 hover:bg-slate-900 hover:text-white transition-all p-0"
                        >
                          <Eye className="h-5 w-5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          onClick={() => handleEdit(customer)}
                          className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-100 hover:bg-emerald-500 hover:text-white transition-all p-0"
                        >
                          <Edit className="h-5 w-5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          onClick={() => handleDelete(customer.id)}
                          className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 border border-rose-100 hover:bg-rose-500 hover:text-white transition-all p-0"
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

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
