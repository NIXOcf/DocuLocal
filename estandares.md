# OWASP Top 10 - Pautas de Seguridad para Aplicaciones Web

El **OWASP Top 10** es un documento de concienciación estándar para la seguridad de las aplicaciones web. Representa un consenso amplio sobre los riesgos de seguridad más críticos para las aplicaciones web.

## Los 10 Riesgos Más Críticos (Edición Actual)

### A01:2021-Control de Acceso Quebrado (Broken Access Control)
* **Nivel de Riesgo:** Crítico
* **Descripción:** Las restricciones sobre lo que los usuarios autenticados pueden hacer no se aplican correctamente. Los atacantes pueden explotar estos defectos para acceder a funciones o datos no autorizados, como cuentas de otros usuarios, archivos confidenciales o derechos de administrador.

### A02:2021-Fallas Criptográficas (Cryptographic Failures)
* **Nivel de Riesgo:** Crítico
* **Descripción:** Anteriormente conocido como *Exposición de Datos Sensibles*. Ocurre cuando los datos en tránsito o en reposo no están protegidos adecuadamente (falta de cifrado o algoritmos débiles), lo que permite a los atacantes robar información confidenciales como tarjetas de crédito o credenciales.

### A03:2021-Inyección (Injection)
* **Nivel de Riesgo:** Alto
* **Descripción:** Incluye vulnerabilidades como SQLi, NoSQL, inyección de comandos o LDAP. Ocurre cuando se envían datos no confiables a un intérprete como parte de un comando o consulta, engañándolo para que ejecute comandos involuntarios.

### A04:2021-Diseño Inseguro (Insecure Design)
* **Nivel de Riesgo:** Alto
* **Descripción:** Es una nueva categoría enfocada en los riesgos relacionados con las fallas de diseño y arquitectura. Si el diseño no contempla la seguridad desde el principio, ninguna implementación posterior podrá corregir estas deficiencias de fondo.

### A05:2021-Configuración de Seguridad Incorrecta (Security Misconfiguration)
* **Nivel de Riesgo:** Alto
* **Descripción:** Incluye la falta de endurecimiento (hardening) de la seguridad, configuraciones predeterminadas de fábrica, mensajes de error demasiado detallados o falta de cabeceras de seguridad HTTP adecuadas.

### A06:2021-Componentes Vulnerables y Desactualizados (Vulnerable and Outdated Components)
* **Nivel de Riesgo:** Medio-Alto
* **Descripción:** Ocurre cuando el software utiliza componentes (librerías, frameworks o módulos) que tienen vulnerabilidades conocidas, están desactualizados o ya no reciben soporte del desarrollador.

### A07:2021-Fallas de Identificación y Autenticación (Identification and Authentication Failures)
* **Nivel de Riesgo:** Alto
* **Descripción:** Anteriormente conocido como *Autenticación Rota*. Permite que se comprometan las credenciales de los usuarios, facilitando ataques de fuerza bruta, el secuestro de sesiones o la suplantación de identidad por falta de controles multifactor (MFA).

### A08:2021-Fallas en la Integridad de Datos y Software (Software and Data Integrity Failures)
* **Nivel de Riesgo:** Alto
* **Descripción:** Se centra en realizar suposiciones sobre la integridad del código o de los datos sin verificarla. Un ejemplo común es la deserialización insegura o el uso de dependencias de repositorios públicos que han sido manipulados.

### A09:2021-Fallas en el Registro y Monitoreo de Seguridad (Security Logging and Monitoring Failures)
* **Nivel de Riesgo:** Medio
* **Descripción:** La falta de registros de auditoría y un monitoreo ineficaz impiden a las organizaciones detectar actividades sospechosas, responder a incidentes a tiempo o realizar análisis forenses tras una brecha de seguridad.

### A10:2021-Falsificación de Solicitudes del Lado del Servidor (SSRF)
* **Nivel de Riesgo:** Medio-Alto
* **Descripción:** Ocurre cuando una aplicación web busca un recurso remoto sin validar la URL proporcionada por el usuario. Permite a un atacante obligar a la aplicación a enviar una solicitud especialmente diseñada a un destino inesperado, evadiendo firewalls o listas de control de acceso.

---
*Nota: Este documento sirve como guía técnica de referencia para desarrolladores y auditores de seguridad.*

# Guía de Referencia: WCAG 2.2
**Pautas de Accesibilidad para el Contenido Web (WCAG) 2.2**

Las WCAG 2.2, desarrolladas por el W3C, son el estándar global para hacer que el contenido web sea más accesible para personas con discapacidades. Este documento resume los principios fundamentales, los niveles de conformidad y los nuevos criterios añadidos en esta versión.

---

## 📌 Los 4 Principios Fundamentales (POUR)

1. **Perceptible (Perceivable):** La información y los componentes de la interfaz de usuario deben ser mostrados a los usuarios en formas que puedan percibir.
2. **Operable (Operable):** Los componentes de la interfaz de usuario y la navegación deben ser operables de manera directa por el usuario.
3. **Comprensible (Understandable):** La información y el funcionamiento de la interfaz de usuario deben ser comprensibles.
4. **Robusto (Robust):** El contenido debe ser suficientemente robusto como para que pueda ser interpretado de forma fiable por una amplia variedad de agentes de usuario, incluyendo las tecnologías de asistencia.

---

## 🎖️ Niveles de Conformidad

* **Nivel A:** Cumplimiento mínimo. Aborda las barreras de accesibilidad más críticas.
* **Nivel AA:** Cumplimiento intermedio. Es el estándar recomendado y el más exigido a nivel legal en todo el mundo.
* **Nivel AAA:** Cumplimiento avanzado. El nivel máximo de accesibilidad, ideal para entornos especializados.

---

## 🚀 Nuevos Criterios de Éxito en WCAG 2.2

La versión 2.2 añade **9 nuevos criterios de éxito**, enfocados principalmente en mejorar la experiencia para usuarios de dispositivos móviles, personas con baja visión y usuarios con discapacidades cognitivas.

### 1. Principio: Operable

* **2.4.11 Foco no oculto (Mínimo) [Nivel AA]:** Cuando un elemento recibe el foco del teclado, este no debe quedar completamente oculto por otros elementos creados por el autor (como banners flotantes o barras fijas).
* **2.4.12 Foco no oculto (Ampliado) [Nivel AAA]:** Ninguna parte del indicador de foco del teclado puede quedar oculta por el contenido creado por el autor.
* **2.4.13 Apariencia del foco [Nivel AAA]:** El indicador de foco del teclado debe tener un tamaño y un contraste de color suficientes con respecto al fondo.
* **2.5.7 Movimientos de arrastre [Nivel AA]:** Toda acción que requiera un movimiento de arrastrar y soltar (drag-and-drop) debe poder realizarse también mediante un solo clic o pulsación simple, a menos que el arrastre sea esencial.
* **2.5.8 Tamaño del objetivo del puntero (Mínimo) [Nivel AA]:** Los elementos interactivos deben tener un tamaño mínimo de 24x24 píxeles (o suficiente espacio alrededor) para evitar clics accidentales.

### 2. Principio: Comprensible

* **3.2.6 Ayuda consistente [Nivel A]:** Si un sitio web ofrece mecanismos de ayuda (como datos de contacto, un chat o una sección de preguntas frecuentes), estos deben ubicarse siempre en el mismo orden relativo en todas las páginas.
* **3.3.7 Entrada redundante [Nivel A]:** La información ya introducida por el usuario en el mismo proceso no debe volver a solicitarse, o bien debe autocompletarse o estar disponible para su selección (por ejemplo, direcciones de facturación idénticas a las de envío).
* **3.3.8 Autenticación accesible (Mínima) [Nivel AA]:** Los procesos de inicio de sesión no deben requerir pruebas de función cognitiva (como memorizar una contraseña compleja o resolver acertijos lógicos) a menos que haya una alternativa o un método de asistencia (como gestores de contraseñas).
* **3.3.9 Autenticación accesible (Ampliada) [Nivel AAA]:** Elimina las excepciones del criterio anterior, prohibiendo que las pruebas de función cognitiva requieran reconocer objetos o imágenes.

---

## 🗑️ Cambios Importantes
* **Eliminación del criterio 4.1.1 (Parsing / Análisis sintáctico):** Este criterio se ha eliminado de la norma WCAG 2.2 debido a que los navegadores modernos y las tecnologías de asistencia ya manejan el parseo de código de manera estandarizada, volviendo redundante este requisito.

---
*Nota: Documento generado con fines informativos y de referencia rápida basados en las especificaciones oficiales de la W3C.*
