"use client"
import { Textarea } from "@/components/ui/textarea"

const PREGUNTAS = [
  { num: "01", pregunta: "¿Qué recibió la atención que esperabas?", placeholder: "Nombra lo que sí ocurrió, aunque haya sido pequeño" },
  { num: "02", pregunta: "¿Qué quedó descuidado?", placeholder: "Sin juicio: solo lo que quedó fuera" },
  { num: "03", pregunta: "¿Qué aprendiste de esta semana?", placeholder: "Una observación honesta basta" },
  { num: "04", pregunta: "¿Qué cambia para la siguiente semana?", placeholder: "Un ajuste concreto, no un plan nuevo" },
] as const

export function ReflexionPreguntas({
  respuestas,
  onChange,
}: {
  respuestas: string[]
  onChange: (indice: number, valor: string) => void
}) {
  return (
    <div className="flex max-w-[70ch] flex-col gap-10">
      {PREGUNTAS.map((q, i) => (
        <div key={q.num}>
          <p className="mb-2.5 font-mono-compass text-[10px] tracking-[0.14em] text-muted-foreground/60">{q.num}</p>
          <label className="mb-4 block font-editorial text-2xl leading-tight text-pretty md:text-[27px]">{q.pregunta}</label>
          <Textarea
            value={respuestas[i] ?? ""}
            onChange={(e) => onChange(i, e.target.value)}
            placeholder={q.placeholder}
            rows={3}
            className="min-h-16 resize-y rounded-none border-0 border-b border-input bg-transparent px-0.5 pb-3 text-[15px] leading-relaxed focus-visible:border-foreground focus-visible:ring-0"
          />
        </div>
      ))}
    </div>
  )
}
