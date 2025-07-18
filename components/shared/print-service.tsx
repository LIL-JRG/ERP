"use client"

import type React from "react"

import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"

interface PrintableDocumentProps {
  title: string
  content: React.ReactNode
  onAfterPrint?: () => void
}

export function PrintableDocument({ title, content, onAfterPrint }: PrintableDocumentProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  const handlePrint = () => {
    if (!contentRef.current) return

    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      alert("Por favor permite ventanas emergentes para imprimir")
      return
    }

    const documentContent = contentRef.current.innerHTML
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
              font-size: 14px;
            }
            .print-header {
              text-align: center;
              margin-bottom: 20px;
            }
            .print-header h1 {
              font-size: 18px;
              margin: 0;
            }
            .print-header p {
              margin: 5px 0;
              font-size: 12px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 15px 0;
            }
            table th, table td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: left;
            }
            table th {
              background-color: #f2f2f2;
            }
            .totals {
              margin-top: 20px;
              text-align: right;
            }
            .totals div {
              margin: 5px 0;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              font-size: 12px;
              border-top: 1px solid #ddd;
              padding-top: 10px;
            }
            @media print {
              body {
                padding: 0;
                font-size: 12px;
              }
              button {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          ${documentContent}
        </body>
      </html>
    `

    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()

    // Esperar a que los estilos y recursos se carguen
    printWindow.onload = () => {
      printWindow.print()
      printWindow.onafterprint = () => {
        if (onAfterPrint) onAfterPrint()
        printWindow.close()
      }
    }
  }

  return (
    <div>
      <div className="hidden">
        <div ref={contentRef}>{content}</div>
      </div>
      <Button onClick={handlePrint} variant="outline" size="sm" className="flex items-center gap-1">
        <Printer className="h-4 w-4" />
        <span>Imprimir</span>
      </Button>
    </div>
  )
}
