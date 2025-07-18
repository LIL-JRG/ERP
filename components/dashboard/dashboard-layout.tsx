"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import {
  Package,
  ShoppingCart,
  FileText,
  Users,
  BarChart3,
  LogOut,
  Menu,
  X,
  Scan,
  Settings,
  Warehouse,
  TrendingUp,
  TrendingDown,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface DashboardLayoutProps {
  children: React.ReactNode
  activeTab: string
  onTabChange: (tab: string) => void
}

const navigation = [
  { id: "dashboard", name: "Dashboard", icon: BarChart3 },
  { id: "products", name: "Productos", icon: Package },
  { id: "inventory", name: "Inventario", icon: Warehouse },
  { id: "sales", name: "Ventas", icon: ShoppingCart },
  { id: "quotes", name: "Cotizaciones", icon: FileText },
  { id: "customers", name: "Clientes", icon: Users },
  { id: "quick-entries", name: "Entradas", icon: TrendingUp },
  { id: "quick-exits", name: "Salidas", icon: TrendingDown },
  { id: "scanner", name: "Escáner", icon: Scan },
  { id: "settings", name: "Configuración", icon: Settings },
]

export default function DashboardLayout({ children, activeTab, onTabChange }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar móvil */}
      <div className={cn("fixed inset-0 z-50 lg:hidden", sidebarOpen ? "block" : "hidden")}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl">
          <div className="flex h-16 items-center justify-between px-4 border-b">
            <h1 className="text-lg font-bold text-gray-900">H2R PDV 1.0</h1>
            <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabChange(item.id)
                    setSidebarOpen(false)
                  }}
                  className={cn(
                    "group flex w-full items-center rounded-md px-2 py-2 text-sm font-medium transition-colors",
                    activeTab === item.id
                      ? "bg-blue-100 text-blue-900"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                  )}
                >
                  <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
                  <span className="truncate">{item.name}</span>
                </button>
              )
            })}
          </nav>
          <div className="border-t p-4">
            <div className="flex items-center">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.email}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar desktop */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200 shadow-sm">
          <div className="flex h-16 items-center px-4 border-b">
            <h1 className="text-xl font-bold text-gray-900">H2R PDV 1.0</h1>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={cn(
                    "group flex w-full items-center rounded-md px-2 py-2 text-sm font-medium transition-colors",
                    activeTab === item.id
                      ? "bg-blue-100 text-blue-900"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                  )}
                >
                  <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
                  <span className="truncate">{item.name}</span>
                </button>
              )
            })}
          </nav>
          <div className="border-t p-4">
            <div className="flex items-center">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.email}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="flex flex-1 flex-col lg:pl-64 min-w-0">
        <div className="flex h-16 items-center justify-between border-b bg-white px-4 lg:px-6 shadow-sm">
          <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold text-gray-900 truncate">
            {navigation.find((item) => item.id === activeTab)?.name || "Dashboard"}
          </h2>
          <div className="w-8 lg:hidden" /> {/* Spacer for mobile */}
        </div>
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="h-full">{children}</div>
        </main>
      </div>
    </div>
  )
}
