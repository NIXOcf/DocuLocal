import type { Conversation, DocumentItem, Source } from "@/types"

export interface MockResponse {
  content: string
  sources: Source[]
}

export interface MockFragment {
  page: number
  score: number
  text: string
}

export const mockDocuments: DocumentItem[] = [
  {
    id: "doc-1",
    name: "Manual_HR.pdf",
    size: "2.4 MB",
    uploadedAt: "2025-01-12T09:15:00.000Z",
    status: "Indexado",
    accessLevel: "General",
  },
  {
    id: "doc-2",
    name: "Politica_Seguridad_TI.pdf",
    size: "1.1 MB",
    uploadedAt: "2025-01-28T11:40:00.000Z",
    status: "Indexado",
    accessLevel: "Jefatura",
  },
  {
    id: "doc-3",
    name: "Contrato_Proveedores_2025.docx",
    size: "856 KB",
    uploadedAt: "2025-02-05T15:05:00.000Z",
    status: "Indexado",
    accessLevel: "Gerencia",
  },
  {
    id: "doc-4",
    name: "Guia_Onboarding.pdf",
    size: "3.7 MB",
    uploadedAt: "2025-02-17T08:30:00.000Z",
    status: "Indexado",
    accessLevel: "General",
  },
  {
    id: "doc-5",
    name: "Reglamento_Interno.pdf",
    size: "1.9 MB",
    uploadedAt: "2025-03-03T13:20:00.000Z",
    status: "Indexado",
    accessLevel: "General",
  },
  {
    id: "doc-6",
    name: "Procedimiento_Reembolsos.xlsx",
    size: "412 KB",
    uploadedAt: "2025-03-14T10:00:00.000Z",
    status: "Indexado",
    accessLevel: "Jefatura",
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

export const mockFragments: Record<string, MockFragment> = {
  "Manual_HR.pdf": {
    page: 14,
    score: 0.92,
    text: "Artículo 7. Vacaciones anuales. El personal con contrato indefinido disfrutará de 22 días laborables de vacaciones retribuidas por año natural. Las solicitudes se tramitarán a través del portal del empleado con una antelación mínima de 15 días. Los días pendientes podrán disfrutarse hasta el 31 de marzo del ejercicio siguiente, siempre con la conformidad del responsable directo.",
  },
  "Politica_Seguridad_TI.pdf": {
    page: 6,
    score: 0.89,
    text: "Sección 3.2. Control de accesos. Todos los sistemas corporativos requieren autenticación multifactor para usuarios internos y externos. Las contraseñas deberán renovarse cada 90 días y no podrán reutilizarse las cinco anteriores. Cualquier incidente de seguridad debe notificarse al equipo de TI en un plazo máximo de 24 horas.",
  },
  "Contrato_Proveedores_2025.docx": {
    page: 9,
    score: 0.84,
    text: "Cláusula 11. Confidencialidad. El proveedor se obliga a mantener la más estricta reserva sobre toda la información a la que tenga acceso con motivo de la prestación del servicio. Esta obligación se extiende a su personal y subcontratistas, y permanecerá vigente durante cinco años tras la finalización del contrato. El incumplimiento facultará a la empresa para resolver el contrato de forma inmediata.",
  },
  "Guia_Onboarding.pdf": {
    page: 3,
    score: 0.81,
    text: "Primera semana. Durante los cinco primeros días, la persona incorporada completará la formación obligatoria en ciberseguridad, prevención de riesgos laborales y código de conducta. Su responsable le asignará un mentor que le acompañará durante los tres primeros meses. Al finalizar la semana se revisará el plan de objetivos iniciales.",
  },
  "Reglamento_Interno.pdf": {
    page: 21,
    score: 0.78,
    text: "Capítulo IV. Permisos y ausencias. Los permisos retribuidos y las vacaciones se registrarán obligatoriamente en el sistema de gestión de personal. El responsable del área dispondrá de cinco días hábiles para aprobar o denegar la solicitud. En caso de coincidencia de fechas dentro de un mismo equipo, tendrá preferencia la solicitud registrada en primer lugar.",
  },
  "Procedimiento_Reembolsos.xlsx": {
    page: 1,
    score: 0.9,
    text: "Hoja 'Instrucciones'. Los gastos deberán justificarse con factura o recibo original en un plazo de 30 días naturales. Cada línea debe indicar fecha, concepto, importe y centro de coste. La solicitud firmada por el responsable del departamento se remitirá a Administración, que abonará el importe en la nómina del mes siguiente.",
  },
}

const SEED_QUESTIONS: { title: string; question: string }[] = [
  {
    title: "Política de vacaciones 2025",
    question: "¿Cuál es la política de vacaciones 2025?",
  },
  {
    title: "Procedimiento de reembolso de gastos",
    question: "¿Cuál es el procedimiento de reembolso de gastos?",
  },
  {
    title: "Normativa de seguridad TI",
    question: "¿Qué establece la normativa de seguridad TI?",
  },
  {
    title: "Onboarding nuevos empleados",
    question: "¿Cómo es el onboarding de nuevos empleados?",
  },
  {
    title: "Contrato marco proveedores",
    question: "¿Qué recoge el contrato marco con proveedores?",
  },
  {
    title: "Código de conducta corporativo",
    question: "¿Qué dice el código de conducta corporativo?",
  },
]

const SEED_BASE_TIME = Date.UTC(2025, 3, 1, 9, 0, 0)
const HOUR = 60 * 60 * 1000

export const seedConversations: Conversation[] = SEED_QUESTIONS.map(
  (seed, index) => {
    const response = mockResponses[index % mockResponses.length]
    const createdAt = SEED_BASE_TIME - index * 24 * HOUR
    const n = index + 1
    return {
      id: `seed-${n}`,
      title: seed.title,
      createdAt,
      updatedAt: createdAt + 60 * 1000,
      messages: [
        {
          id: `seed-${n}-user`,
          role: "user",
          content: seed.question,
          createdAt,
        },
        {
          id: `seed-${n}-assistant`,
          role: "assistant",
          content: response.content,
          sources: response.sources,
          feedback: null,
          createdAt: createdAt + 60 * 1000,
        },
      ],
    }
  },
)
