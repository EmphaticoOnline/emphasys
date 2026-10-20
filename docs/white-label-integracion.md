# Estrategia de integración — `feature/white-label` → `main`

> Actualizado el 2026-10-19 sobre HEAD `2fc649c`. Solo plan: no se hizo push, no se creó el PR, no se corrigió el upstream y no se tocó `main`.
> Esta versión reemplaza a la anterior, que decía que `main` no había avanzado.

## 1. Estado medido

| Dato | Valor |
|---|---|
| HEAD de la rama | `2fc649c` — `test(theme): register the main merge in the fixture chain` |
| Commits de la rama sobre `main` | **68**: 66 de White Label, el merge `b86c3b4` y la corrección de pruebas `2fc649c` |
| `main` (local y remoto) | `8761927` (2026-10-19 19:42): "fix: corrige scroll de configuración y resiliencia de recordatorios" |
| Relación con `main` | La rama **ya contiene todo `main`**: 0 commits de `main` le faltan. La integración no tiene conflictos pendientes |
| Rama en el remoto | **No existe** todavía (`git ls-remote` vacío) |
| Upstream configurado | ⚠️ Sigue en `origin/main` (ver §6, R1). No se ha corregido |
| Diff contra `main` | 244 archivos, +23 600 / −1 393 |
| ↳ Componentes y páginas (`frontend/src`, fuera de `theme/`) | 133 archivos, +1 373 / −1 146: sustituciones 1 a 1 de literales por tokens |
| ↳ `frontend/src/theme` (capas, pruebas y fixtures) | 98 archivos, +20 006 / −237 |
| ↳ de eso, fixtures `__fixtures__/` | 63 archivos, +15 189 (64 % del diff): datos de equivalencia, no lógica |
| ↳ `docs/` | 10 archivos, +2 203 |
| Backend, BD, `package.json` y scripts de deploy | **Sin cambios de White Label**. Los cambios de backend que trae el merge son de `main` y ya están en `main` |
| CI | No hay workflows. El deploy es manual (`npm run deploy`, rsync), así que integrar **no despliega** |
| Carpeta principal `emphasys` | En `main` (`8761927`), limpia |

### 1.1 El merge de `main` en la rama

- `main` avanzó con un commit propio, `8761927`, ya publicado en el remoto. Toca:
  - `backend/package.json`;
  - `backend/src/crm/activity-reminders.job.ts`;
  - `backend/src/scripts/testActivityRemindersJob.ts`;
  - `frontend/src/components/configuracion/configVisual.tsx`.
- La rama lo incorporó con el merge **`b86c3b4`** (`Merge remote-tracking branch 'origin/main' into feature/white-label`), sin conflictos manuales.
- **Cambios de `main` que se conservan:** el arreglo de scroll de `ConfigPageFrame` en `configVisual.tsx` y los cambios de recordatorios del backend. White Label no revierte ninguno.
  - En `configVisual.tsx` conviven el arreglo de `main` y el cambio D-B4 de White Label.
- **Corrección de pruebas, commit `2fc649c`:** el merge desplazó líneas de `configVisual.tsx`, y 4 pruebas de equivalencia (W1 y D-B4) ya no podían revertir ese archivo a su HEAD histórico.
  - Se agregó al arnés de pruebas un tipo de fixture para merges de `main` (`merges.main-8761927.baseline.json`), y la prueba `mainMerges.test.ts` verifica que estén el arreglo de `main` y los cambios de White Label.
  - No se modificó código de la aplicación.

Referencias a hashes de esta rama:
- en `docs/`: 37 referencias a 22 commits distintos;
- en fixtures: 52 archivos guardan `"source": "HEAD <sha>"`;
- en Notion (PE-101 a PE-109): decenas de referencias.

## 2. Validación

| Verificación | Resultado (HEAD `2fc649c`) |
|---|---|
| `node --test src/theme/*.test.ts src/pages/*.test.ts` | ✅ 172/172 |
| `tsc --noEmit` | ✅ 213 errores preexistentes, idénticos uno por uno a los de `b86c3b4` y `57216bd`; 0 nuevos |
| `npm run build` | ✅ |
| `git diff --check` | ✅ |
| Paridad de tokens, temas MUI, `index.html` y manifest | ✅ (`brandParity.test.ts`) |
| Marca alternativa (`acmeBrand`) | ✅ (`whiteLabelBrand.test.ts`; build real en copia temporal) |
| Cierre global de colores | ✅ Solo quedan 32 exclusiones documentadas (`whiteLabelClosure.test.ts`) |
| **Revisión visual manual** (`docs/white-label-validacion-final.md` §4.2) | ✅ **Completada** y confirmada por el usuario el 2026-10-19 |

Detalle de la revisión visual confirmada:
- D1 (saldo al corte), D2 (filas de movimientos de inventario), D4 (días vencidos en programación de pagos) y D6 (retención del desglose fiscal): correctos.
- Oportunidades (franja `grid.stripe` y encabezado azul del grid): correcto.
- `/dev/mockups/*` funciona en desarrollo.

## 3. Estado de las tareas

| Tarea | Estado para esta fase |
|---|---|
| PE-107 Migrar colores por bloques | **Lista para publicación e integración**: sin migraciones ni decisiones pendientes |
| PE-109 Validación final | **Lista para publicación e integración**: validación automática y visual completas |
| PE-108 Marca en backend (PDFs, correos, plantillas de WhatsApp) | **Fuera de esta fase.** No se ha iniciado y no bloquea la integración del frontend |

PE-107 y PE-109 siguen abiertas en Notion. Se marcan como hechas cuando lo confirmes, con el PR y el merge como evidencia.

## 4. Opciones de integración

| Opción | Historial en `main` | Hashes de la evidencia | Revertir | `git bisect` | Veredicto |
|---|---|---|---|---|---|
| **A. PR con "Create a merge commit"** (`--no-ff`) | Los 68 commits más 1 merge que agrupa el proyecto | **Se conservan** | Todo con `git revert -m 1 <merge>`, o un bloque con `git revert <sha>` | Por commit | ✅ **Recomendada** |
| B. Squash | 1 commit | Se pierden en `main`: los 37 de docs, los 52 de fixtures y los de Notion apuntarían a commits que solo viven en la rama | Todo o nada | Inútil (+23 k líneas en un commit) | ❌ |
| C. Rebase and merge (GitHub) | Commits reescritos | **Cambian**, y el merge `b86c3b4` se aplanaría | Por commit | Por commit | ❌ Rompe las referencias |
| D. Fast-forward local | Los 68 commits, sin commit de merge propio | Se conservan | Por commit; el proyecto completo no tiene un punto único | Por commit | Válida, pero sin PR ni revisión registrada |

**Por qué A:**
- la rama ya está organizada en commits pequeños y verificados;
- la evidencia de PE-101 a PE-109 cita sus hashes;
- el commit de merge da un punto único para revertir todo el proyecto.

Las pruebas comparan SHA-256 de contenido, no hashes de commit. La documentación y el campo `source` de los fixtures sí dependen de esos hashes.

## 5. Pasos pendientes (cada uno requiere tu autorización)

1. **Corregir el upstream** (R1): `git branch --unset-upstream feature/white-label`.
2. **Publicar la rama** (push): `git push -u origin feature/white-label`.
3. **Abrir el PR en borrador** `feature/white-label` → `main` con el texto de §5.1.
4. **Revisar el PR antes del merge**, con la guía de §5.2. Si `main` avanza mientras tanto, hay que integrarlo en la rama con merge (no rebase) y volver a correr la verificación de §2.
5. Merge con **"Create a merge commit"**, como paso aparte, después de la revisión.
6. Después del merge, también como pasos aparte:
   - actualizar la carpeta principal `emphasys` con `git pull --ff-only`;
   - hacer el deploy, primero a pruebas (`npm run deploy:test`) y luego a producción.

**Rollback**
- Todo el proyecto: `git revert -m 1 <commit de merge>`.
- Un bloque o una decisión: `git revert <sha>`, del más nuevo al más viejo.

### 5.1 Borrador del PR

**Título:** `White label: capa de marca, tokens y migración de colores (PE-99)`

**Descripción:**

```markdown
## Qué hace
Base white label de Emphasys ERP. La identidad (colores, tipografías, logos y metadata) vive en
`frontend/src/theme/brand/`. Una marca nueva se activa en `brand/active.ts` y `brand/logos.ts`, sin
tocar componentes (guía: `docs/white-label-guia-nueva-marca.md`).

- Capas: marca → tokens y temas MUI derivados; funcional (`functional.ts`); estructural
  (`structural.ts`); sombras y degradados (`elevation.ts`); tintes (`tints.ts`); signo (`sign.ts`).
- Fuera de `theme/` no queda ningún color escrito a mano, salvo 32 exclusiones documentadas
  (datos de BD, fallbacks y KPI).
- Los mockups de diseño se montan solo en desarrollo.

## Apariencia
- La apariencia de Emphasys se conserva byte a byte: los fixtures congelados de tokens, temas MUI,
  `index.html` y manifest son idénticos, y cada bloque prueba su equivalencia contra el HEAD previo.
- **4 cambios visuales aprobados** (`docs/white-label-decisiones-diseno.md`), revisados manualmente:
  - D1: saldo al corte del estado de cuenta;
  - D2: filas del informe de movimientos de inventario;
  - D4: días vencidos en programación de pagos;
  - D6: retención del desglose fiscal.

## Integra main
Incluye el merge de `main` `8761927` (`b86c3b4`). Conserva el arreglo de scroll de `ConfigPageFrame` y
los cambios de recordatorios del backend. `2fc649c` adapta la cadena de fixtures de pruebas a ese merge.

## Sin cambios
Backend, base de datos, scripts de deploy y dependencias: White Label no los toca. La marca en el backend
(PE-108) queda para una fase posterior.

## Verificación
- `node --test`: 172/172.
- `tsc --noEmit`: 213 errores preexistentes, 0 nuevos.
- `npm run build` correcto.
- Build con una marca alternativa (`acmeBrand`): solo quedan colores Emphasys documentados.
- Revisión visual manual completa (checklist §4.2 de `docs/white-label-validacion-final.md`).

## Cómo revisar
Ver la guía de revisión de `docs/white-label-integracion.md` (§5.2). Los fixtures de
`theme/__fixtures__/` (+15 k líneas) son datos de equivalencia, no lógica.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

### 5.2 Guía de revisión (orden sugerido)

| # | Qué | Archivos | Tiempo | Foco |
|---|---|---|---|---|
| 1 | Capa de marca | `theme/brand/*`, `tokens.ts`, `createEmphasysTheme.ts` | 20 min | Que la identidad salga solo de `BrandDefinition` |
| 2 | Capas de color | `functional.ts`, `structural.ts`, `elevation.ts`, `tints.ts`, `sign.ts`, `color.ts` | 30 min | Nombres por rol; ningún valor unificado por coincidir |
| 3 | Componentes | 133 archivos fuera de `theme/` | 45–60 min | Sustituciones 1 a 1 de literal por token. Basta revisar por muestreo: el cierre global y la equivalencia SHA prueban el resto |
| 4 | Cambios visuales | `6e8bf8f`, `dfd259d`, `981fa96` y `57216bd` | 10 min | Que solo cambie lo aprobado (ya revisado manualmente) |
| 5 | Mockups y H3 | `App.tsx` (`f6e0b8c`) | 5 min | Que las 138 rutas sigan iguales y que los mockups solo existan en desarrollo |
| 6 | Merge de `main` | `b86c3b4` y `2fc649c` | 10 min | Que `configVisual.tsx` conserve el arreglo de `main` y D-B4, y que `2fc649c` solo toque el arnés de pruebas |
| 7 | Pruebas | `theme/*.test.ts` | 20 min | Leer `brandParity`, `whiteLabelBrand`, `whiteLabelClosure` y `mainMerges`. Los fixtures se pueden saltar |

## 6. Riesgos

- **R1 — Upstream apuntando a `main` (sigue abierto).** `feature/white-label` sigue a `origin/main`. Con el `push.default` actual (`simple`), un `git push` sin argumentos se rechaza porque los nombres difieren. Pero `git push origin HEAD:main` publicaría directo en `main` sin PR. **Mitigación:** paso 1 de §5 (`--unset-upstream`) y publicar con `-u origin feature/white-label`.
- **R2 — Tamaño del diff.** 23,6 k líneas, de las cuales los fixtures son el 64 %. La guía de §5.2 reduce la revisión a unas 2,5 h.
- **R3 — Cambios propios de `main`.** `8761927` ya está integrado y se conserva. Si `main` avanza otra vez antes del merge:
  - integrarlo en la rama con merge, no con rebase;
  - registrar en `MERGE_ORDER` los archivos de la cadena de fixtures que toque, como hizo `2fc649c`;
  - volver a correr la verificación de §2.
  - Nunca resolver un conflicto descartando los cambios de `main`.
- **R4 — Deploy.** No hay CI, y el deploy manual sube lo que haya en el checkout local. Hay que desplegar primero a pruebas.
- **R5 — Referencias a hashes.** Si se elige squash o rebase pese a la recomendación, hay que actualizar las referencias en `docs/`, en los fixtures (`source`) y en Notion.
