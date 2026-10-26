import { useRef, useState } from "react"
import type { ChangeEvent, DragEvent } from "react"
import {
  CheckCircle2,
  FileText,
  Globe,
  Loader2,
  Lock,
  Trash2,
  UploadCloud,
  Users,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { RejectedFile } from "@/context/DocumentsContext"
import { useDocuments } from "@/hooks/useDocuments"
import { FOCUS_RING_LIGHT } from "@/lib/styles"
import { cn } from "@/lib/utils"
import type { AccessLevel } from "@/types"

const ACCESS_LEVELS: readonly AccessLevel[] = ["General", "Jefatura", "Gerencia"]

const LEVEL_STYLES: Record<AccessLevel, { icon: LucideIcon; className: string }> = {
  General: {
    icon: Globe,
    className: "border-slate-300 bg-slate-100 text-slate-800",
  },
  Jefatura: {
    icon: Users,
    className: "border-sky-200 bg-sky-50 text-sky-800",
  },
  Gerencia: {
    icon: Lock,
    className: "border-violet-200 bg-violet-50 text-violet-800",
  },
}

function isAccessLevel(value: unknown): value is AccessLevel {
  return ACCESS_LEVELS.some((level) => level === value)
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("es-ES")
}

function AdminView() {
  const { documents, addFiles, removeDocument } = useDocuments()
  const [isDragging, setIsDragging] = useState(false)
  const [selectedLevel, setSelectedLevel] = useState<AccessLevel>("General")
  const [statusMessage, setStatusMessage] = useState("")
  const [rejected, setRejected] = useState<RejectedFile[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFiles = (fileList: FileList | null) => {
    if (fileList === null || fileList.length === 0) return
    const result = addFiles(Array.from(fileList), selectedLevel)
    setStatusMessage(
      result.added > 0
        ? `${result.added} documento(s) añadido(s) con nivel ${selectedLevel}`
        : "",
    )
    setRejected(result.rejected)
  }

  const openFileDialog = () => {
    fileInputRef.current?.click()
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

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">
            Panel de Administración
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Gestiona los documentos que alimentan la base de conocimiento
          </p>
        </header>

        <section aria-labelledby="upload-heading">
          <h2 id="upload-heading" className="sr-only">
            Cargar documentos
          </h2>

          <div className="mb-4 flex flex-col gap-2">
            <Label htmlFor="access-level" className="text-slate-900">
              Nivel de acceso del documento
            </Label>
            <Select
              value={selectedLevel}
              onValueChange={(value) => {
                if (isAccessLevel(value)) setSelectedLevel(value)
              }}
            >
              <SelectTrigger
                id="access-level"
                aria-describedby="access-level-help"
                className={cn(
                  "h-11 w-full rounded-sm border-slate-500 bg-white text-slate-900 sm:w-72",
                  FOCUS_RING_LIGHT,
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-sm bg-white ring-slate-300">
                {ACCESS_LEVELS.map((level) => {
                  const Icon = LEVEL_STYLES[level].icon
                  return (
                    <SelectItem
                      key={level}
                      value={level}
                      className="min-h-9 rounded-sm text-slate-900 focus:bg-slate-100 focus:outline-2 focus:-outline-offset-2 focus:outline-slate-900 data-highlighted:bg-slate-100 data-highlighted:outline-2 data-highlighted:-outline-offset-2 data-highlighted:outline-slate-900"
                    >
                      <Icon className="size-4 text-slate-700" aria-hidden="true" />
                      {level}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            <p id="access-level-help" className="text-xs text-slate-600">
              Se aplica a los archivos que cargues a continuación.
            </p>
          </div>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-sm border-2 border-dashed border-slate-500 bg-white px-6 py-10 text-center transition-colors",
              isDragging && "border-slate-900 bg-slate-100",
            )}
          >
            <UploadCloud
              className="size-12 text-slate-600"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <div>
              <p className="text-base font-medium text-slate-900">
                Arrastra y suelta tus documentos aquí
              </p>
              <p className="mt-1 text-sm text-slate-600">
                o selecciona archivos · PDF, DOCX, XLSX · máx. 20 MB
              </p>
            </div>
            <Button
              type="button"
              onClick={openFileDialog}
              className={cn(
                "mt-2 h-11 rounded-sm bg-slate-900 px-5 text-white hover:bg-slate-800",
                FOCUS_RING_LIGHT,
              )}
            >
              Seleccionar archivos
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.xlsx"
              tabIndex={-1}
              aria-hidden="true"
              className="sr-only"
              onChange={handleFileChange}
            />
          </div>

          <div className="mt-4 space-y-3">
            <p role="status" className="text-sm font-medium text-emerald-800 empty:hidden">
              {statusMessage}
            </p>
            {rejected.length > 0 && (
              <div
                role="alert"
                className="rounded-sm border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                <p className="font-semibold">
                  {rejected.length === 1
                    ? "1 archivo no se pudo añadir:"
                    : `${rejected.length} archivos no se pudieron añadir:`}
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {rejected.map((item, index) => (
                    <li key={`${index}-${item.name}`} className="break-all">
                      <span className="font-medium">{item.name}</span>: {item.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        <Card className="mt-8 gap-0 rounded-sm py-0 ring-slate-200">
          <CardHeader className="flex items-center justify-between border-b border-slate-200 py-4">
            <h2 className="text-base leading-snug font-semibold text-slate-900">
              Documentos indexados
            </h2>
            <span className="rounded-sm bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              {documents.length}{" "}
              {documents.length === 1 ? "documento" : "documentos"}
            </span>
          </CardHeader>
          <CardContent className="px-0">
            {documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <FileText className="size-8 text-slate-600" aria-hidden="true" />
                <p className="text-sm text-slate-600">
                  No hay documentos indexados
                </p>
              </div>
            ) : (
              <Table>
                <caption className="sr-only">Documentos indexados</caption>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead scope="col" className="pl-6 text-slate-700">
                      Nombre
                    </TableHead>
                    <TableHead scope="col" className="text-slate-700">
                      Nivel de acceso
                    </TableHead>
                    <TableHead scope="col" className="text-slate-700">
                      Tamaño
                    </TableHead>
                    <TableHead scope="col" className="text-slate-700">
                      Fecha de carga
                    </TableHead>
                    <TableHead scope="col" className="text-slate-700">
                      Estado
                    </TableHead>
                    <TableHead scope="col" className="pr-6 text-right text-slate-700">
                      Acciones
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => {
                    const level = LEVEL_STYLES[doc.accessLevel]
                    const LevelIcon = level.icon
                    return (
                      <TableRow key={doc.id}>
                        <TableCell className="pl-6">
                          <div className="flex max-w-xs items-center gap-2 font-medium text-slate-900">
                            <FileText
                              className="size-4 shrink-0 text-slate-600"
                              aria-hidden="true"
                            />
                            <span className="truncate" title={doc.name}>
                              {doc.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn("rounded-sm", level.className)}
                          >
                            <LevelIcon aria-hidden="true" />
                            {doc.accessLevel}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-700">{doc.size}</TableCell>
                        <TableCell className="text-slate-700">
                          {formatDate(doc.uploadedAt)}
                        </TableCell>
                        <TableCell>
                          {doc.status === "Indexado" ? (
                            <Badge
                              variant="outline"
                              className="rounded-sm border-emerald-200 bg-emerald-50 text-emerald-700"
                            >
                              <CheckCircle2 aria-hidden="true" />
                              Indexado
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="rounded-sm border-amber-200 bg-amber-50 text-amber-700"
                            >
                              <Loader2
                                className="animate-spin motion-reduce:animate-none"
                                aria-hidden="true"
                              />
                              Procesando
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="pr-6 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeDocument(doc.id)}
                            aria-label={`Eliminar documento ${doc.name}`}
                            title="Eliminar documento"
                            className={cn(
                              "size-8 rounded-sm text-slate-700 hover:bg-red-50 hover:text-red-700",
                              FOCUS_RING_LIGHT,
                            )}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
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
