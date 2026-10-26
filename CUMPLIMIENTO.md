# BaseSaber v0.2 — Reporte de cumplimiento

Fuente de requisitos: `estandares.md` (OWASP Top 10 2021 + resumen de WCAG 2.2).
Alcance: prototipo frontend (SPA) sin backend. Leyenda: ✅ cumple · ⚠️ cumple parcialmente / depende del backend · ❌ no cumple.

## 1. Reglas de `estandares.md`

### OWASP Top 10 (2021)

| ID | Resumen | Archivo(s) | Estado | Nota |
|----|---------|------------|--------|------|
| A01 | Control de acceso quebrado | `components/routing/ProtectedRoute.tsx`, `components/routing/RoleRoute.tsx`, `components/AccessDenied.tsx`, `components/Sidebar.tsx`, `context/AuthProvider.tsx` | ⚠️ | Rutas protegidas por sesión; `/admin` muestra "Acceso denegado" al Empleado y el enlace de administración no se renderiza en su DOM. Es control **solo de interfaz**: el rol vive en el cliente y es manipulable. El RBAC real debe aplicarse en el backend (comentado en el código). |
| A02 | Fallas criptográficas / exposición de datos | `lib/storage.ts`, `context/AuthProvider.tsx`, `lib/id.ts` | ✅ | No se almacenan contraseñas, tokens ni datos sensibles; la sesión solo guarda rol y caducidad. IDs con `crypto.randomUUID()` (fallback con `crypto.getRandomValues`, nunca `Math.random`). En producción: HTTPS + HSTS y cookies httpOnly/Secure/SameSite (ver §4). |
| A03 | Inyección | `lib/sanitize.ts`, `context/ChatProvider.tsx`, `context/DocumentsProvider.tsx`, todos los componentes | ✅ | Entradas normalizadas (NFC), sin caracteres de control ni bidireccionales, con longitud máxima. Sin `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function` ni `document.write` (verificado con búsqueda). React escapa toda la salida. Rutas con `encodeURIComponent`. |
| A04 | Diseño inseguro | `lib/validators.ts`, `context/*Provider.tsx`, `lib/sanitize.ts` | ✅ | Límites por diseño: 2000 caracteres por mensaje, 10 archivos por operación, 20 MB por archivo, lista blanca de extensiones, 50 conversaciones, 100 mensajes por conversación, 200 documentos. Bloqueo de envíos concurrentes. |
| A05 | Configuración de seguridad incorrecta | `index.html`, `CUMPLIMIENTO.md` §4 | ⚠️ | `<meta name="referrer" content="no-referrer">`. Mensajes de error genéricos y en español. La CSP no se aplica por `<meta>` en desarrollo porque rompería el HMR de Vite; la CSP y las cabeceras de producción se documentan en §4. |
| A06 | Componentes vulnerables o desactualizados | `package.json`, `package-lock.json` | ✅ | `npm audit`: 0 vulnerabilidades (25-10-2026). Dependencias en versiones actuales. Única dependencia nueva: `react-router-dom` 7.18.4. |
| A07 | Fallas de identificación y autenticación | `context/AuthProvider.tsx`, `components/LoginView.tsx` | ⚠️ | Autenticación **simulada**. Sesión con caducidad de 8 h: se valida al hidratar y se cierra automáticamente al expirar. MFA, bloqueo por fuerza bruta y gestión real de sesión quedan para el backend. |
| A08 | Fallas de integridad de datos y software | `lib/storage.ts`, `lib/validators.ts` | ✅ | Deserialización segura: `JSON.parse` en try/catch y type guards manuales (estructura, enums, longitudes, límites e IDs únicos). Un dato manipulado o corrupto se descarta y se usa el valor por defecto. `package-lock.json` versionado. El paquete `cn` que añadió shadcn se verificó como oficial (mantenedor shadcn, repositorio `shadcn-ui/cn`). |
| A09 | Fallas de registro y monitoreo | — | ❌ | Fuera del alcance de un prototipo sin backend: no hay registro de auditoría ni monitoreo. En producción deben registrarse en servidor los inicios de sesión, los accesos denegados, las cargas y las eliminaciones. |
| A10 | SSRF | — | ✅ (N/A) | La aplicación no realiza peticiones a URLs ni acepta URLs del usuario. No hay llamadas HTTP. |

### WCAG 2.2

| ID | Resumen | Archivo(s) | Estado | Nota |
|----|---------|------------|--------|------|
| POUR-P | Perceptible | Todos los componentes | ✅ | Contraste de texto ≥ 4.5:1 (ver tabla de contraste). Iconos decorativos con `aria-hidden`. Estados con icono y texto, no solo color. Tabla con `<caption>` y `scope="col"`. |
| POUR-O | Operable | Todos los componentes | ✅ | Toda la aplicación se opera con teclado. Enlace "Saltar al contenido principal". Botón "Detener generación" (2.2.2). Escape cierra el diálogo y el panel lateral. |
| POUR-C | Comprensible | Todos los componentes | ✅ | `lang="es"`. Etiquetas y ayudas visibles o `sr-only` asociadas con `aria-describedby`. Mensajes de error que explican el motivo. |
| POUR-R | Robusto | Todos los componentes | ✅ | HTML semántico: landmarks `aside`/`nav`/`main`, un `h1` por vista, `role="log"`, `role="status"`, `role="alert"`, `aria-pressed`, `aria-current`, `aria-expanded`. Lint jsx-a11y sin avisos. |
| AA | Nivel de conformidad objetivo | Global | ⚠️ | Se aplican los criterios AA conocidos, incluido 1.4.10 (Reflow) aunque el documento no lo cita. Falta validación con auditoría manual y tecnologías de apoyo reales (ver §5). |
| 2.4.11 | Foco no oculto (mínimo, AA) | `lib/styles.ts`, `components/AppLayout.tsx` | ✅ | No hay barras flotantes que tapen el foco. En móvil, `<main>` queda `inert` mientras el panel lateral está superpuesto, así que el foco no puede quedar debajo. Las listas con scroll tienen margen interno para el anillo. |
| 2.4.12 | Foco no oculto (ampliado, AAA) | Ídem | ✅ | Ningún elemento propio cubre el indicador de foco. |
| 2.4.13 | Apariencia del foco (AAA) | `lib/styles.ts`, `components/AdminView.tsx` | ✅ | Anillo sólido de 2 px con desplazamiento de 2 px: `slate-900` sobre fondo claro y blanco sobre `slate-900`, contraste ≈ 17:1. Las opciones del Select usan contorno de 2 px. |
| 2.5.7 | Movimientos de arrastre (AA) | `components/AdminView.tsx` | ✅ | La zona Drag & Drop tiene como alternativa el botón "Seleccionar archivos", que abre el selector nativo. |
| 2.5.8 | Tamaño del objetivo (mínimo, AA) | Todos los componentes | ✅ | Mínimo 28 px (insignias de fuentes) y 32 px (feedback y eliminar). Controles principales de 44 px (login, enviar, seleccionar, menú, enlaces de la barra lateral). |
| 3.2.6 | Ayuda consistente (A) | `components/ChatView.tsx` | ✅ (N/A) | No hay mecanismos de ayuda de contacto. Los textos de ayuda del chat y de la carga están siempre en la misma posición. |
| 3.3.7 | Entrada redundante (A) | — | ✅ (N/A) | No hay procesos de varios pasos que pidan dos veces el mismo dato. |
| 3.3.8 | Autenticación accesible (mínima, AA) | `components/LoginView.tsx` | ✅ | El inicio de sesión es con un clic por rol, sin contraseñas ni pruebas cognitivas. |
| 3.3.9 | Autenticación accesible (ampliada, AAA) | `components/LoginView.tsx` | ✅ | Sin reconocimiento de objetos ni imágenes. |
| 4.1.1 | Parsing (eliminado en WCAG 2.2) | — | ✅ (N/A) | Criterio obsoleto. El JSX genera marcado válido. |

### Contraste verificado (valores aproximados de la paleta Tailwind)

| Uso | Colores | Contraste |
|-----|---------|-----------|
| Texto secundario sobre claro | `slate-600` / blanco | ≈ 7.6:1 |
| Texto pequeño sobre oscuro | `slate-300` / `slate-900` | ≈ 12:1 |
| Estado "Indexado" | `emerald-700` / `emerald-50` | ≈ 5.2:1 |
| Estado "Procesando" | `amber-700` / `amber-50` | ≈ 4.8:1 |
| Nivel "Jefatura" / "Gerencia" | `sky-800` / `sky-50`; `violet-800` / `violet-50` | ≈ 7.4:1; ≈ 8.9:1 |
| Bordes de Input, Select y zona de carga | `slate-500` / blanco | ≈ 4.8:1 (requisito ≥ 3:1) |
| Anillo de foco | `slate-900` / blanco; blanco / `slate-900` | ≈ 17:1 |

## 2. Discrepancias entre `estandares.md` y el prompt

| Tema | `estandares.md` | Prompt | Prevaleció |
|------|-----------------|--------|------------|
| Reflow (1.4.10) | No lo menciona, pero fija AA como nivel recomendado | Sidebar colapsable solo si el documento lo exige | **El más estricto:** se implementó el panel colapsable bajo `md`, con `aria-expanded`, `aria-controls`, cierre con Escape y retorno del foco. |
| Criterios AAA (2.4.12, 2.4.13, 3.3.9) | Los lista | Pide foco visible, no especifica AAA | **El documento:** se cumplieron también los AAA listados. |
| A09 Registro y monitoreo | Lo exige | No lo menciona | No aplicable sin backend → ❌ documentado. |
| Linter de accesibilidad | — | `eslint-plugin-jsx-a11y` en `eslint.config.js` | El proyecto usa **oxlint**, no ESLint, y no existe `eslint.config.js`. Instalar ESLint violaba la regla "no instales otra librería". Se activó el **plugin jsx-a11y nativo de oxlint** con las reglas del preset *recommended* en `.oxlintrc.json`. Se desactivó `prefer-tag-over-role`, que no está en el preset recomendado y sugiere `<output>`/`<fieldset>`, en conflicto con el `role="status"` y `role="group"` exigidos. |
| Diálogo | "comportamiento nativo de Radix" | — | Los componentes shadcn instalados usan **Base UI**, no Radix. Base UI aporta trampa de foco, cierre con Escape y retorno del foco (`finalFocus`, que se pasa explícitamente al botón de la fuente). |

## 3. Limitaciones conocidas

- **RBAC solo en cliente:** cualquier usuario puede editar la sesión en DevTools y ver `/admin`. Es aceptable en un prototipo; en producción el backend debe autorizar cada petición.
- **Datos compartidos por navegador:** conversaciones y documentos se guardan en el navegador sin separar por usuario. Cerrar sesión no los borra.
- **Sin CSP en desarrollo:** la CSP por `<meta>` rompería el HMR de Vite. Debe enviarse como cabecera HTTP en producción (§4).
- **Sin pruebas automatizadas de accesibilidad:** solo análisis estático (oxlint jsx-a11y). No hay axe ni Playwright, porque el prompt prohíbe librerías nuevas. Requiere la verificación manual de §5.
- **Carga simulada:** solo se leen nombre y tamaño del archivo. No se valida el contenido real (*magic bytes*), algo que el servidor sí debe hacer.
- **Generación simulada:** las respuestas rotan entre tres textos fijos.

## 4. CSP y cabeceras recomendadas para producción

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://api.basesaber.example; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Set-Cookie: session=<id>; HttpOnly; Secure; SameSite=Strict; Path=/
```

Ajusta `connect-src` al dominio real de la API. Si alguna librería inyecta estilos en línea, valida `style-src` antes de desplegar.

## 5. Checklist de pruebas manuales

**Teclado**
- [ ] Tab desde la carga muestra primero "Saltar al contenido principal" y al activarlo el foco pasa a `<main>`.
- [ ] Login: ambos botones funcionan con Enter y con Espacio.
- [ ] Chat: escribir, Enter para enviar; el foco permanece en el campo; "Detener generación" es alcanzable con Tab.
- [ ] Fuente citada: Enter abre el diálogo, Tab queda atrapado dentro, Escape cierra y el foco vuelve a la insignia.
- [ ] Feedback: Espacio alterna `aria-pressed`.
- [ ] Admin: el Select se abre con Enter o Espacio, se recorre con flechas y se elige con Enter. "Seleccionar archivos" abre el selector. "Eliminar" funciona con teclado.
- [ ] El foco es siempre visible y nunca queda oculto.

**Lector de pantalla (NVDA + Firefox/Chrome, VoiceOver + Safari)**
- [ ] Se anuncia "Buscando en la base documental" y "El asistente está escribiendo la respuesta" sin leer palabra por palabra.
- [ ] La respuesta final se anuncia una sola vez, y también "Valoración registrada" / "Valoración eliminada".
- [ ] La carga anuncia "N documento(s) añadido(s)…" y los rechazos como alerta.
- [ ] El Empleado en `/admin` escucha "Acceso denegado".
- [ ] Los landmarks y encabezados se recorren de forma coherente.

**Zoom y reflow**
- [ ] Al 200 % todo es legible y operable.
- [ ] Al 400 % (≈ 320 px de ancho) aparece el botón de menú; el panel lateral se abre y se cierra (también con Escape) y el contenido no requiere scroll horizontal, salvo la tabla, que tiene su propio scroll.

**Movimiento reducido** (activar "Reducir movimiento" en el sistema operativo)
- [ ] La respuesta aparece completa tras la búsqueda, sin efecto de escritura.
- [ ] Spinners y cursor sin animación; scroll instantáneo.

**Alto contraste** (Windows: Temas de contraste)
- [ ] Los anillos de foco, bordes y estados siguen siendo visibles y los iconos se distinguen.

**Seguridad**
- [ ] Editar `basesaber:v2:session` en DevTools con `role: "root"` y recargar: vuelve al login.
- [ ] Escribir JSON inválido en `basesaber:v2:conversations` y recargar: se cargan las conversaciones de ejemplo sin error.
- [ ] Subir `.exe`, un archivo vacío y uno de más de 20 MB: se rechazan con su motivo.
- [ ] Un nombre con caracteres bidireccionales (U+202E) se muestra saneado.
