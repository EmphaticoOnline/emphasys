# Campaña: Evaluación Empresarial en 4 Minutos

Anuncios para pauta pagada en Facebook e Instagram de **Emphasys Soluciones**.

## Objetivo

Promocionar la **Evaluación Empresarial en 4 Minutos**, una herramienta gratuita que ayuda a los empresarios a identificar fortalezas y posibles áreas de mejora en su negocio. La evaluación es gratuita y los resultados se consultan sin registrarse.

La pieza no vende software ni un ERP. Busca que el empresario tome conciencia de lo importante que es conocer y controlar mejor su empresa, y que esa inquietud lo lleve a hacer la evaluación.

Criterios de éxito. Que el empresario:

1. Detenga su atención mientras navega.
2. Se identifique con la inquietud planteada.
3. Sienta curiosidad por conocer la respuesta.
4. Quiera hacer la evaluación gratuita.

## Mensaje publicitario aprobado

| Elemento | Texto |
|---|---|
| Mensaje principal | **¿CUÁNTO TE ESTÁ COSTANDO LO QUE NO SABES DE TU EMPRESA?** |
| Mensaje secundario | Descúbrelo con nuestra Evaluación Empresarial en 4 Minutos. |
| Llamado a la acción | Evalúa tu empresa en 4 minutos |
| Nota de apoyo | Gratis · Sin registro |

## Identidad visual

- Se usa el logotipo original (`assets/logo-emphasys.png`, PNG transparente de 1493 × 848) sin redibujar ni cambiar colores, proporciones o tipografía.
- Colores de marca, tomados directamente del logotipo:
  - Azul marino `#1d2f68`
  - Verde petróleo `#006261`
  - Tinte petróleo `#80b1b0`, que aparece en el propio logotipo y se usa solo para detalles sobre fondo oscuro.
- No se usa naranja ni colores ajenos a la marca.
- Tipografías: Avenir Next y Avenir Next Condensed. Ambas vienen con macOS.

## Propuestas

### Propuesta A: fotográfica

Fondo azul marino. Un empresario aparece a la derecha, reflexionando con la mano en la barbilla, con un tratamiento de color azul marino y petróleo. **La imagen fue generada con inteligencia artificial** y es la original aprobada desde el primer diseño. Los íconos sutiles de finanzas, equipo, documentos y crecimiento forman parte de esa misma imagen. El titular va a la izquierda y la frase "TE ESTÁ COSTANDO" está resaltada sobre un bloque petróleo. El botón es blanco con texto azul marino.

El logotipo va en un panel blanco anclado a la esquina superior izquierda. El panel toca los bordes, tiene un filo petróleo y queda alineado con la columna de texto, así que forma parte de la retícula en vez de flotar como etiqueta. Esto es necesario porque el logotipo, en azul marino, no se leería sobre el fondo oscuro.

**Estado:** lista. El logotipo está integrado y se usa la imagen original generada con IA, que es la aprobada.

### Propuesta B: conceptual (**aprobada**)

Fondo claro y diseño tipográfico. "LO QUE NO SABES" es el elemento dominante, en petróleo. Debajo hay una gráfica de barras discreta: cinco áreas aparecen medidas (ventas, compras, inventario, cobranza y gastos) y tres aparecen sin medir, con un signo de interrogación (márgenes, procesos y rentabilidad). No usa fotografías. El logotipo va a color sobre el fondo claro y el botón es azul marino.

**Estado:** aprobada. No se le deben hacer cambios visuales.

## Archivos

```
campana-evaluacion-empresarial/
├── README.md
├── comparativa.png                  ← A y B lado a lado (solo para revisión)
├── propuesta-a/
│   ├── propuesta-a.png              ← FINAL 1080 × 1080
│   ├── propuesta-a.html             ← editable
│   └── assets/
│       ├── logo-emphasys.png        ← logotipo oficial
│       └── foto-empresario-ia.jpg   ← imagen del empresario generada con IA (aprobada)
├── propuesta-b/
│   ├── propuesta-b.png              ← FINAL 1080 × 1080 (aprobada)
│   ├── propuesta-b.html             ← editable
│   └── assets/
│       └── logo-emphasys.png
├── referencias/
│   ├── anuncio-referencia.jpg       ← anuncio de referencia original (no publicar)
│   ├── provisional/
│   │   └── foto-provisional-de-referencia.jpg  ← copia de la imagen IA original
│   └── descartada-unsplash/         ← foto de Unsplash retirada (no se usa) y su ficha de licencia
└── scripts/
    ├── render.sh                    ← regenera los PNG con Chrome sin interfaz
    └── comparativa.py               ← genera comparativa.png
```

## Cómo regenerar los PNG

Requisitos: macOS con Google Chrome instalado. Para generar la comparativa también hace falta Python 3 con Pillow.

```bash
cd marketing/redes-sociales/campana-evaluacion-empresarial
./scripts/render.sh        # propuestas A y B, más la comparativa
./scripts/render.sh a      # solo la propuesta A
./scripts/render.sh b      # solo la propuesta B
```

Si Chrome no está en la ruta estándar: `CHROME="/ruta/a/chrome" ./scripts/render.sh`.

El script abre cada HTML en Chrome sin interfaz, a 1080 × 1080 con escala 1, y guarda el PNG junto al HTML. Para editar textos o estilos, modifica el `.html` y vuelve a ejecutar el script. Los HTML usan rutas relativas a su carpeta `assets/`.

## Origen y licencias de las imágenes

| Archivo | Uso | Estado |
|---|---|---|
| `propuesta-a/assets/foto-empresario-ia.jpg` | Propuesta A | **Imagen generada con inteligencia artificial**, original y aprobada. Es un recorte de la zona del empresario del anuncio de referencia (`referencias/anuncio-referencia.jpg`), también generado con IA, sin su texto ni su logotipo. |
| `referencias/descartada-unsplash/*` | Ninguno | Foto de Unsplash (bruce mars) que se probó y se retiró por decisión del cliente. Se conserva solo como histórico, con su ficha de licencia. |
| `referencias/anuncio-referencia.jpg` | Solo como referencia | No debe publicarse tal cual, porque tiene otro logotipo y colores ajenos a la marca. |
| `propuesta-b/*` | Propuesta B | No usa fotografías. Solo contiene el logotipo propio. |

## Pendientes para publicar

- [ ] Elegir la propuesta final (A o B) y cargar el PNG en Meta Ads Manager con la URL de destino de la evaluación.
- [ ] Si Meta lo solicita para la pauta, declarar que la Propuesta A contiene una imagen generada con IA.
