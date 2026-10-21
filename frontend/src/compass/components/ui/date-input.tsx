import * as React from "react"
import { CalendarDays } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  formatDateDisplay,
  formatIsoDateTimeLocalDisplay,
  isValidIsoDate,
  maskDisplayInput,
  parseDisplayDate,
  parseDisplayDateTime,
} from "../../../shared/dates/dateUtils"

// Campo de fecha ligero de Compass: se ve y se teclea como DD/MM/YYYY, pero el
// valor que entra y sale es siempre ISO (YYYY-MM-DD o YYYY-MM-DDTHH:mm). El
// calendario nativo (input oculto) solo sirve como selector.

type BaseProps = {
  value: string
  onChange: (value: string) => void
  id?: string
  className?: string
  disabled?: boolean
  "aria-label"?: string
}

function useFechaInput(value: string, withTime: boolean, onChange: (v: string) => void) {
  const format = withTime ? formatIsoDateTimeLocalDisplay : formatDateDisplay
  const parse = withTime ? parseDisplayDateTime : parseDisplayDate
  const [draft, setDraft] = React.useState(() => format(value))
  const [invalid, setInvalid] = React.useState(false)
  const lastEmitted = React.useRef(value)

  // Sincroniza cuando el valor cambia desde fuera (p. ej. semana anterior/siguiente).
  React.useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value
      setDraft(format(value))
      setInvalid(false)
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const emit = (next: string) => {
    lastEmitted.current = next
    onChange(next)
  }

  const handleText = (raw: string) => {
    const masked = maskDisplayInput(raw, withTime)
    setDraft(masked)
    if (masked === "") {
      setInvalid(false)
      if (value !== "") emit("")
      return
    }
    const iso = parse(masked)
    setInvalid(iso === null && masked.length === (withTime ? 16 : 10))
    if (iso !== null) emit(iso)
  }

  const handleBlur = () => {
    if (draft !== "" && parse(draft) === null) setInvalid(true)
  }

  const handleNative = (iso: string) => {
    setDraft(format(iso))
    setInvalid(false)
    emit(iso)
  }

  return { draft, invalid, handleText, handleBlur, handleNative }
}

function Campo({ withTime, value, onChange, id, className, disabled, ...rest }: BaseProps & { withTime: boolean }) {
  const { draft, invalid, handleText, handleBlur, handleNative } = useFechaInput(value, withTime, onChange)
  const nativeRef = React.useRef<HTMLInputElement>(null)
  const nativeValue = withTime ? (value && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) ? value.slice(0, 16) : "") : isValidIsoDate(value) ? value : ""

  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={withTime ? "DD/MM/AAAA HH:mm" : "DD/MM/AAAA"}
        value={draft}
        disabled={disabled}
        aria-label={rest["aria-label"]}
        aria-invalid={invalid || undefined}
        onChange={(event) => handleText(event.target.value)}
        onBlur={handleBlur}
        className="pr-9"
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-label="Abrir calendario"
        onClick={() => nativeRef.current?.showPicker?.()}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        <CalendarDays className="size-4" />
      </button>
      <input
        ref={nativeRef}
        type={withTime ? "datetime-local" : "date"}
        value={nativeValue}
        tabIndex={-1}
        aria-hidden
        onChange={(event) => event.target.value && handleNative(event.target.value)}
        className="pointer-events-none absolute bottom-0 right-0 h-px w-px opacity-0"
      />
    </div>
  )
}

export function DateInput(props: BaseProps) {
  return <Campo {...props} withTime={false} />
}

export function DateTimeInput(props: BaseProps) {
  return <Campo {...props} withTime />
}
