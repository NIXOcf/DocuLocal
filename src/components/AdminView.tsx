import { useEffect, useRef, useState } from "react"
import type { ChangeEvent, DragEvent, KeyboardEvent } from "react"
import { CheckCircle2, FileText, Loader2, Trash2, UploadCloud } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { mockDocuments } from "@/data/mockData"
import { cn } from "@/lib/utils"
import type { DocumentItem } from "@/types"

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function AdminView() {
  const [documents, setDocuments] = useState<DocumentItem[]>(mockDocuments)
  const [isDragging, setIsDragging] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const timeoutsRef = useRef<number[]>([])

  useEffect(() => {
    const timeouts = timeoutsRef
    return () => {
      timeouts.current.forEach((id) => clearTimeout(id))
      timeouts.current = []
    }
  }, [])

  const processFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return

    const today = new Date().toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })

    const newDocs: DocumentItem[] = Array.from(files).map((file) => ({
      id: `doc-${crypto.randomUUID()}`,
      name: file.name,
      size: formatFileSize(file.size),
      uploadedAt: today,
      status: "Procesando",
    }))

    setDocuments((prev) => [...newDocs, ...prev])

    newDocs.forEach((doc) => {
      const timeoutId = window.setTimeout(() => {
        setDocuments((prev) =>
          prev.map((d) => (d.id === doc.id ? { ...d, status: "Indexado" } : d)),
        )
        timeoutsRef.current = timeoutsRef.current.filter((t) => t !== timeoutId)
      }, 2500)
      timeoutsRef.current.push(timeoutId)
    })
  }

  const openFileDialog = () => {
    fileInputRef.current?.click()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      openFileDialog()
    }
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    processFiles(e.dataTransfer.files)
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files)
    e.target.value = ""
  }

  const handleDelete = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id))
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-8 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">
            Panel de Administración
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Gestiona los documentos que alimentan la base de conocimiento
          </p>
        </header>

        <div
          role="button"
          tabIndex={0}
          aria-label="Zona de carga de documentos"
          onClick={openFileDialog}
          onKeyDown={handleKeyDown}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-3 rounded-sm border-2 border-dashed border-slate-300 bg-white px-6 py-10 text-center outline-none transition-colors focus-visible:border-slate-900",
            isDragging && "border-slate-900 bg-slate-100",
          )}
        >
          <UploadCloud className="size-12 text-slate-400" strokeWidth={1.5} />
          <div>
            <p className="text-base font-medium text-slate-900">
              Arrastra y suelta tus documentos aquí
            </p>
            <p className="mt-1 text-sm text-slate-500">
              o haz clic para seleccionar · PDF, DOCX, XLSX
            </p>
          </div>
          <Button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              openFileDialog()
            }}
            className="mt-2 h-9 rounded-sm bg-slate-900 px-4 text-white hover:bg-slate-800"
          >
            Seleccionar archivos
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            accept=".pdf,.docx,.xlsx"
            onChange={handleFileChange}
          />
        </div>

        <Card className="mt-8 gap-0 rounded-sm py-0 ring-slate-200">
          <CardHeader className="flex items-center justify-between border-b border-slate-200 py-4">
            <CardTitle className="text-base font-semibold text-slate-900">
              Documentos indexados
            </CardTitle>
            <span className="rounded-sm bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {documents.length}{" "}
              {documents.length === 1 ? "documento" : "documentos"}
            </span>
          </CardHeader>
          <CardContent className="px-0">
            {documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <FileText className="size-8 text-slate-300" />
                <p className="text-sm text-slate-500">
                  No hay documentos indexados
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="pl-6 text-slate-600">Nombre</TableHead>
                    <TableHead className="text-slate-600">Tamaño</TableHead>
                    <TableHead className="text-slate-600">
                      Fecha de carga
                    </TableHead>
                    <TableHead className="text-slate-600">Estado</TableHead>
                    <TableHead className="pr-6 text-right text-slate-600">
                      Acciones
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-2 font-medium text-slate-900">
                          <FileText className="size-4 shrink-0 text-slate-400" />
                          <span className="truncate">{doc.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {doc.size}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {doc.uploadedAt}
                      </TableCell>
                      <TableCell>
                        {doc.status === "Indexado" ? (
                          <Badge
                            variant="outline"
                            className="rounded-sm border-emerald-200 bg-emerald-50 text-emerald-700"
                          >
                            <CheckCircle2 />
                            Indexado
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="rounded-sm border-amber-200 bg-amber-50 text-amber-700"
                          >
                            <Loader2 className="animate-spin" />
                            Procesando
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(doc.id)}
                          aria-label={`Eliminar ${doc.name}`}
                          title="Eliminar documento"
                          className="rounded-sm text-slate-500 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default AdminView
