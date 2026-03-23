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
  Search,
  Bell,
  UserCircle,
  RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface DashboardLayoutProps {
  children: React.ReactNode
  activeTab: string
  onTabChange: (tab: string) => void
}

const navigation = [
  { id: "dashboard", name: "Panel General", icon: BarChart3 },
  { id: "products", name: "Productos", icon: Package },
  { id: "inventory", name: "Inventario", icon: Warehouse },
  { id: "scanner", name: "Escáner", icon: Scan },
  { id: "sales", name: "Ventas", icon: ShoppingCart },
  { id: "quotes", name: "Cotizaciones", icon: FileText },
  { id: "quick-entries", name: "Entradas Rápidas", icon: TrendingUp },
  { id: "quick-exits", name: "Salidas Rápidas", icon: TrendingDown },
  { id: "customers", name: "Clientes", icon: Users },
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

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-[#f1f5f9] border-r border-gray-200">
      {/* Sidebar Header */}
      <div className="p-6 pb-4">
        <h1 className="text-3xl font-medium text-[#1e293b] tracking-tighter leading-none">
          H2R
          <span className="text-[#10b981]"> ERP</span><span className="text-sm border ml-2 border-[#10b981]/30 bg-[#10b981]/10 text-[#10b981] px-2 py-0.5 rounded-full font-bold align-middle inline-block">v2.0</span>
        </h1>
      </div>

      {/* User Info */}
      <div className="px-4 mb-6">
        <div className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <Avatar className="h-11 w-11 border-2 border-[#10b981]">
            <AvatarImage src="" />
            <AvatarFallback className="bg-[#10b981] text-white font-medium text-sm">JH</AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <span className="text-[15px] font-medium text-slate-900 truncate tracking-tight">Jorge Herrera</span>
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mt-1">Gerente General</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
        {navigation.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          return (
            <button
              key={item.id}
              onClick={() => {
                onTabChange(item.id)
                setSidebarOpen(false)
              }}
              className={cn(
                "group flex w-full items-center rounded-[14px] px-4 py-3 text-[15px] font-medium transition-all duration-300",
                isActive
                  ? "bg-[#10b981] text-white shadow-md shadow-emerald-100/50"
                  : "text-slate-500 hover:bg-white hover:text-slate-900 hover:shadow-sm",
              )}
            >
              <Icon className={cn("mr-3 h-[20px] w-[20px] transition-colors", isActive ? "text-white" : "text-slate-400 group-hover:text-[#10b981]")} />
              <span className="tracking-tight">{item.name}</span>
            </button>
          )
        })}
      </nav>

      {/* Footer Nav */}
      <div className="p-4 space-y-1 mt-auto border-t border-slate-200/50">
        <button
          onClick={() => onTabChange("settings")}
          className="flex w-full items-center rounded-[14px] px-4 py-3 text-[15px] font-medium text-slate-500 hover:bg-white transition-all group"
        >
          <Settings className="mr-3 h-[20px] w-[20px] text-slate-400 group-hover:text-[#10b981] transition-colors" />
          Configuración
        </button>
        <button
          onClick={handleLogout}
          className="flex w-full items-center rounded-[14px] px-4 py-3 text-[15px] font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-all group"
        >
          <LogOut className="mr-3 h-[20px] w-[20px] text-slate-400 group-hover:text-rose-600 transition-colors" />
          Cerrar Sesión
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Mobile Sidebar */}
      <div className={cn("fixed inset-0 z-50 lg:hidden", sidebarOpen ? "block" : "hidden")}>
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-72 flex-col shadow-2xl animate-in slide-in-from-left duration-300">
          <div className="absolute top-4 right-4 lg:hidden">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} className="rounded-full">
               <X className="h-5 w-5" />
            </Button>
          </div>
          <SidebarContent />
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0">
         <SidebarContent />
      </div>

      {/* Main Column */}
      <div className="flex flex-1 flex-col lg:pl-72 min-w-0">
        {/* Mobile Menu Trigger (Floating) */}
        <div className="lg:hidden fixed top-4 left-4 z-50">
          <Button variant="outline" size="icon" className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border-slate-200" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-6 w-6 text-slate-600" />
          </Button>
        </div>

        {/* Dynamic Content */}
        <main className="flex-1 overflow-y-auto scroll-smooth flex flex-col">
          <div className="flex-1 bg-[#f8fafc] p-0">
            {children}
          </div>

          {/* Footer localized */}
          <footer className="px-6 lg:px-8 py-5 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-bold text-slate-400 bg-white/50">
            <div className="flex items-center gap-4">
               <div className="flex items-center gap-1.5">
                 <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                 <span>SISTEMAS OPERATIVOS</span>
               </div>
               <div className="w-px h-3 bg-slate-200" />
               <span>VERSIÓN 2.0</span>
            </div>
            <div className="tracking-tight uppercase text-[10px]">
              © 2026 H2R ERP.
            </div>
          </footer>
        </main>
      </div>
    </div>
  )
}


