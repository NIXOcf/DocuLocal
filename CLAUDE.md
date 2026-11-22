# DocuLocal

## Arquitectura multi-agente

Subagentes definidos en `.claude/agents/`. `.claude/settings.json` hace que la sesión principal corra como `orchestrator` (`"agent": "orchestrator"`), porque en Claude Code un subagente no puede lanzar otros subagentes: solo el agente principal puede delegar.

| Agente | Modelo | Rol | Herramientas |
|---|---|---|---|
| `orchestrator` | Sonnet (o Opus) | Planifica, divide en subtareas, decide el diseño, coordina y revisa | Agent(explorer, coder, auditor), Read, Glob, Grep, TaskCreate/Update/List/Get |
| `explorer` | Haiku | Explora y mapea el codebase (solo lectura) | Read, Glob, Grep |
| `coder` | Sonnet | Implementa, modifica y depura según el plan | Read, Edit, Write, Bash, Glob, Grep |
| `auditor` | Sonnet | Audita calidad, rúbrica INGT1003 y seguridad OWASP (solo lectura) | Read, Glob, Grep, Bash |

## Restricción de modelos y cuota
- **PROHIBIDO** invocar `subagent_type: "general-purpose"` u omitir `subagent_type` al llamar a `Agent`.
- Usa `explorer` (Haiku) para toda lectura o búsqueda inicial antes de planificar.

## Regla general

Ante **cualquier tarea de desarrollo**, el flujo es obligatorio:

1. Invocar a `orchestrator` (Opus) para coordinar la tarea (es el agente principal de la sesión; si no lo es, usar `claude --agent orchestrator`).
2. `orchestrator` delega la investigación a `explorer` (Haiku) pasando explícitamente `subagent_type: "explorer"` en la herramienta `Agent`.
3. `orchestrator` delega la implementación a `coder` (Sonnet) pasando explícitamente `subagent_type: "coder"` en la herramienta `Agent`.
4. `orchestrator` revisa el resultado final antes de darla por terminada.

