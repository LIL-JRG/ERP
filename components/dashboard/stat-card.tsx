import { Card, CardContent } from "@/components/ui/card"
import { LucideIcon, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  trend?: {
    value: string
    isPositive: boolean
  }
  badge?: {
    text: string
    type: "success" | "warning" | "neutral"
  }
  trendLabel?: string
  footer?: React.ReactNode
  loading?: boolean
  className?: string
}

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  loading,
  className,
  badge,
  footer,
  trendLabel = "vs mes ant."
}: StatCardProps) {
  if (loading) {
    return (
      <Card className={cn("border-none shadow-sm rounded-3xl overflow-hidden bg-white animate-pulse", className)}>
        <CardContent className="p-5 md:p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="h-3 w-20 bg-slate-100 rounded-full" />
            <div className="h-8 w-8 bg-slate-100 rounded-xl" />
          </div>
          <div className="h-8 w-28 bg-slate-100 rounded-lg mb-3" />
          <div className="h-10 w-full bg-slate-50 rounded-xl" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn(
      "border-none shadow-sm rounded-3xl overflow-hidden bg-white hover:shadow-lg transition-all duration-300 group",
      className
    )}>
      <CardContent className="p-6 md:p-8">
        <div className="flex justify-between items-start mb-4">
          <div className="space-y-1.5 min-w-0">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] truncate">
              {title}
            </h3>
            {badge && (
              <span className={cn(
                "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight",
                badge.type === 'success' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                badge.type === 'warning' ? "bg-amber-50 text-amber-600 border border-amber-100" :
                "bg-slate-50 text-slate-600 border border-slate-100"
              )}>
                {badge.text}
              </span>
            )}
          </div>
          <div className={cn(
            "p-3.5 rounded-xl bg-[#f8fafc] text-slate-400 group-hover:bg-[#10b981] group-hover:text-white transition-all duration-500 shadow-sm",
          )}>
            <Icon className="h-7 w-7" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5 mb-6">
          <div className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter flex items-baseline gap-2 leading-none">
            {value}
          </div>
          {trend && (
            <div className={cn(
              "flex items-center gap-2 text-[11px] font-black",
              trend.isPositive ? "text-emerald-600" : "text-rose-600"
            )}>
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-current/10">
                {trend.isPositive ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
              </span>
              <span>{trend.value} <span className="text-slate-400 font-bold">{trendLabel}</span></span>
            </div>
          )}
        </div>

        {footer && (
          <div className="pt-4 border-t border-slate-50/80">
            {footer}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
