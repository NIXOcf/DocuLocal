import type { ChatHistoryItem, DocumentItem, Source } from "@/types"

export interface MockResponse {
  content: string
  sources: Source[]
}

export const mockHistory: ChatHistoryItem[] = [
  { id: "chat-1", title: "Política de vacaciones 2025" },
  { id: "chat-2", title: "Procedimiento de reembolso de gastos" },
  { id: "chat-3", title: "Normativa de seguridad TI" },
  { id: "chat-4", title: "Onboarding nuevos empleados" },
  { id: "chat-5", title: "Contrato marco proveedores" },
  { id: "chat-6", title: "Código de conducta corporativo" },
]

export const mockDocuments: DocumentItem[] = [
  {
    id: "doc-1",
    name: "Manual_HR.pdf",
    size: "2.4 MB",
    uploadedAt: "12/01/2025",
    status: "Indexado",
  },
  {
    id: "doc-2",
    name: "Politica_Seguridad_TI.pdf",
    size: "1.1 MB",
    uploadedAt: "28/01/2025",
    status: "Indexado",
  },
  {
    id: "doc-3",
    name: "Contrato_Proveedores_2025.docx",
    size: "856 KB",
    uploadedAt: "05/02/2025",
    status: "Indexado",
  },
  {
    id: "doc-4",
    name: "Guia_Onboarding.pdf",
    size: "3.7 MB",
    uploadedAt: "17/02/2025",
    status: "Indexado",
  },
  {
    id: "doc-5",
    name: "Reglamento_Interno.pdf",
    size: "1.9 MB",
    uploadedAt: "03/03/2025",
    status: "Indexado",
  },
  {
    id: "doc-6",
    name: "Procedimiento_Reembolsos.xlsx",
    size: "412 KB",
    uploadedAt: "14/03/2025",
    status: "Indexado",
  },
]

export const mockResponses: MockResponse[] = [
  {
    content:
      "Según el Manual de Recursos Humanos, cada empleado dispone de 22 días laborables de vacaciones al año, que deben solicitarse con al menos 15 días de antelación a través del portal del empleado. Los días no disfrutados pueden trasladarse hasta el 31 de marzo del año siguiente, previa aprobación del responsable directo.",
    sources: [
      { id: "src-1", filename: "Manual_HR.pdf" },
      { id: "src-2", filename: "Reglamento_Interno.pdf" },
    ],
  },
  {
    content:
      "Los gastos de viaje y representación se reembolsan presentando los justificantes originales en un plazo máximo de 30 días desde su realización. La hoja de cálculo oficial debe completarse con el centro de coste correspondiente y contar con la firma del responsable del departamento. El abono se realiza en la siguiente nómina tras la validación por parte de Administración.",
    sources: [{ id: "src-3", filename: "Procedimiento_Reembolsos.xlsx" }],
  },
  {
    content:
      "La política de seguridad TI exige el uso de autenticación de doble factor en todos los sistemas corporativos y el cambio de contraseña cada 90 días. Los proveedores con acceso a información interna deben firmar el acuerdo de confidencialidad incluido en el contrato marco. Durante el onboarding, todo nuevo empleado completa una formación obligatoria en ciberseguridad.",
    sources: [
      { id: "src-4", filename: "Politica_Seguridad_TI.pdf" },
      { id: "src-5", filename: "Contrato_Proveedores_2025.docx" },
      { id: "src-6", filename: "Guia_Onboarding.pdf" },
    ],
  },
]
