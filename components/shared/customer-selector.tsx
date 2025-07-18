"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Search, Percent, Check, User } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  discount_percentage: number
}

interface CustomerSelectorProps {
  onCustomerSelect: (customer: Customer | null) => void
  selectedCustomer: Customer | null
}

export default function CustomerSelector({ onCustomerSelect, selectedCustomer }: CustomerSelectorProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  useEffect(() => {
    if (isDialogOpen) {
      fetchCustomers()
    }
  }, [isDialogOpen])

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, email, phone, discount_percentage")
        .order("name")

      if (error) throw error
      setCustomers(data || [])
    } catch (error) {
      console.error("Error fetching customers:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCustomerSelect = (customer: Customer) => {
    onCustomerSelect(customer)
    setIsDialogOpen(false)
  }

  const handleClearCustomer = () => {
    onCustomerSelect(null)
  }

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (customer.phone && customer.phone.includes(searchTerm)),
  )

  return (
    <div className="space-y-2">
      {selectedCustomer ? (
        <div className="flex items-center justify-between p-3 border rounded-md">
          <div>
            <div className="font-medium">{selectedCustomer.name}</div>
            <div className="text-sm text-gray-600 flex items-center gap-2">
              {selectedCustomer.discount_percentage > 0 && (
                <Badge className="bg-green-100 text-green-800">
                  <Percent className="h-3 w-3 mr-1" />
                  {selectedCustomer.discount_percentage}% descuento
                </Badge>
              )}
              {selectedCustomer.phone && <span>{selectedCustomer.phone}</span>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(true)}>
              Cambiar
            </Button>
            <Button variant="ghost" size="sm" onClick={handleClearCustomer}>
              Quitar
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => setIsDialogOpen(true)} variant="outline" className="w-full">
          <User className="h-4 w-4 mr-2" />
          Seleccionar Cliente
        </Button>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Seleccionar Cliente</DialogTitle>
          </DialogHeader>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar clientes por nombre, email o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>

          <div className="overflow-y-auto flex-1 -mx-6 px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Descuento</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4">
                      Cargando clientes...
                    </TableCell>
                  </TableRow>
                ) : filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4">
                      No se encontraron clientes
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((customer) => (
                    <TableRow
                      key={customer.id}
                      className={selectedCustomer?.id === customer.id ? "bg-blue-50" : ""}
                      onClick={() => handleCustomerSelect(customer)}
                    >
                      <TableCell>
                        <div className="font-medium">{customer.name}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {customer.email && <div>{customer.email}</div>}
                          {customer.phone && <div>{customer.phone}</div>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {customer.discount_percentage > 0 ? (
                          <Badge className="bg-green-100 text-green-800">
                            <Percent className="h-3 w-3 mr-1" />
                            {customer.discount_percentage}%
                          </Badge>
                        ) : (
                          <span className="text-gray-500">Sin descuento</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {selectedCustomer?.id === customer.id && <Check className="h-4 w-4 text-blue-600" />}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
