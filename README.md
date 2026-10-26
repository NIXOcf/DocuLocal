# BaseSaber 🛡️
**Plataforma RAG (Retrieval-Augmented Generation) Corporativa 100% Local**

BaseSaber es un sistema de gestión documental impulsado por Inteligencia Artificial diseñado para PYMEs. Su núcleo arquitectónico garantiza **"cero fugas de datos" (Zero Data Leaks)** procesando documentos confidenciales, embeddings y modelos de lenguaje (LLMs) íntegramente en hardware local, asegurando la máxima privacidad y cumplimiento corporativo.

---

## 🚀 Características Principales (Frontend - Hito 1)

*   **Arquitectura SPA Fluida:** Construida con React y enrutamiento dinámico para una experiencia de usuario sin interrupciones.
*   **Control de Acceso Basado en Roles (RBAC):**
    *   *Perfil Empleado:* Acceso exclusivo al chat interactivo para consultas operativas.
    *   *Perfil Administrador:* Acceso global, incluyendo el panel de gestión y subida de documentos.
*   **Chat Corporativo Interactivo (Tipo Gemini):**
    *   Simulación de streaming de respuestas (efecto máquina de escribir).
    *   Trazabilidad de datos mediante insignias (badges) interactivas que muestran las fuentes documentales exactas citadas por la IA.
    *   Sistema de recolección de feedback (Pulgar arriba/abajo) para métricas de calidad.
*   **Gestión Documental Segura (AdminView):**
    *   Zona de Drag & Drop nativa para indexación de archivos.
    *   **Pre-filtrado por Metadatos:** Asignación de "Niveles de Acceso" (General, Jefatura, Gerencia) en el momento de la subida para garantizar una arquitectura *Zero Trust*.
*   **Estándares de Industria:** Diseño corporativo estrictamente alineado con directrices de accesibilidad **WCAG 2.2** y principios de seguridad frontend **OWASP**.

---

## 🛠️ Stack Tecnológico

### Frontend (Fase Actual)
*   **Framework:** React (TypeScript) + Vite
*   **Enrutamiento:** React Router DOM
*   **Estilos:** Tailwind CSS v4
*   **Componentes UI:** shadcn/ui + lucide-react
*   **Persistencia (Prototipo):** LocalStorage API

### Backend & Datos (Fase Próxima - Hito 2)
*   **API REST:** FastAPI (Python)
*   **Base de Datos Relacional y Vectorial:** PostgreSQL + extensión `pgvector`
*   **Motor RAG:** Arquitectura multicapa (Clean Architecture) con filtrado previo en base de datos.
*   **Motor IA Local:** `llama.cpp` ejecutando modelos cuantizados (Llama 3 8B / Gemma) optimizados para GPU (8GB VRAM).

---

## ⚙️ Instalación y Configuración (Desarrollo)

Asegúrate de tener instalado [Node.js](https://nodejs.org/) (versión 18 o superior).

1. **Clonar el repositorio y acceder a la carpeta:**
   ```bash
   git clone <url-del-repositorio>
   cd basesaber-app
Instalar las dependencias:

Bash
npm install
Ejecutar el servidor de desarrollo:

Bash
npm run dev
Acceder a la aplicación:
Abre tu navegador y dirígete a http://localhost:5173
