"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import LoginForm from "@/components/auth/login-form"
import DashboardLayout from "@/components/dashboard/dashboard-layout"
import ProductsManager from "@/components/products/products-manager"
import BarcodeScanner from "@/components/scanner/barcode-scanner"
import DashboardView from "@/components/dashboard/dashboard-view"
import InventoryManager from "@/components/inventory/inventory-manager"
import CustomersManager from "@/components/customers/customers-manager"
import SalesManager from "@/components/sales/sales-manager"
import QuotesManager from "@/components/quotes/quotes-manager"
import SettingsManager from "@/components/settings/settings-manager"
import QuickEntries from "@/components/cash/quick-entries"
import QuickExits from "@/components/cash/quick-exits"

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("dashboard")

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setLoading(false)
    }

    getSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const renderContent = () => {
    switch (activeTab) {
      case "products":
        return <ProductsManager />
      case "scanner":
        return <BarcodeScanner />
      case "inventory":
        return <InventoryManager />
      case "sales":
        return <SalesManager />
      case "quotes":
        return <QuotesManager />
      case "customers":
        return <CustomersManager />
      case "quick-entries":
        return <QuickEntries />
      case "quick-exits":
        return <QuickExits />
      case "settings":
        return <SettingsManager />
      default:
        return <DashboardView />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    return <LoginForm />
  }

  return (
    <DashboardLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderContent()}
    </DashboardLayout>
  )
}
