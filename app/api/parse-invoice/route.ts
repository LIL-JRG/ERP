/* export const dynamic = "force-dynamic";
import { type NextRequest, NextResponse } from "next/server" */
/* import pdfParse from "pdf-parse" */

/* export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File

    if (!file || file.type !== "application/pdf") {
      return NextResponse.json({ error: "Archivo inválido. Debe ser un PDF." }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    try {
      const data = await pdfParse(buffer)
      return NextResponse.json({ text: data.text })
    } catch (parseError) {
      console.error("Error al parsear PDF:", parseError)
      return NextResponse.json({ error: "Error al analizar el contenido del PDF" }, { status: 500 })
    }
  } catch (error) {
    console.error("Error en API parse-invoice:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
 */