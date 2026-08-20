"use client"

import { useEffect, useState } from "react"
import { useRealWork } from "@/lib/real-work-store"
import { fechaYHoraLocalAISOString } from "@/lib/format"
import type { Captura, FrenteCategoria, ProcesarCaptura } from "../../../services/compassService"

export type Destino = "tarea" | "actividad" | "idea" | "decision" | "frente"

/**
 * Lógica de "procesar una Captura" compartida entre el panel de escritorio y
 * la hoja de móvil, para que ambas superficies visuales se apoyen en el
 * mismo estado y en las mismas llamadas reales — nunca dos flujos paralelos.
 */
export function useProcesarCaptura(captura: Captura | null, onProcesada?: () => void | Promise<void>) {
  const { frentes, loadFrentes, procesarCaptura, loading } = useRealWork()
  const [destino, setDestino] = useState<Destino | null>(null)
  const [frenteId, setFrenteId] = useState("")
  const [fecha, setFecha] = useState("")
  const [hora, setHora] = useState("")
  const [nombre, setNombre] = useState("")
  const [proposito, setProposito] = useState("")
  const [categoria, setCategoria] = useState<FrenteCategoria>("personal")

  useEffect(() => { void loadFrentes() }, [loadFrentes])
  useEffect(() => {
    setDestino(null); setFrenteId(""); setFecha(""); setHora(""); setNombre(""); setProposito(""); setCategoria("personal")
  }, [captura?.id])

  const valid = destino === "tarea" || destino === "idea" || destino === "decision"
    || (destino === "actividad" && !!fecha && !!hora)
    || (destino === "frente" && nombre.trim().length > 0)

  async function submit(discard: boolean) {
    if (!captura) return
    let payload: ProcesarCaptura
    if (discard) {
      payload = { destino: "descartar" }
    } else if (destino === "tarea") {
      payload = { destino, frente_id: frenteId ? Number(frenteId) : null }
    } else if (destino === "actividad") {
      if (!fecha || !hora) return
      const inicio = fechaYHoraLocalAISOString(fecha, hora)
      const fin = new Date(new Date(inicio).getTime() + 3600000).toISOString()
      payload = { destino, frente_id: frenteId ? Number(frenteId) : null, tarea_id: null, inicio_programado: inicio, fin_programado: fin }
    } else if (destino === "frente") {
      if (!nombre.trim()) return
      payload = { destino, nombre: nombre.trim(), proposito: proposito.trim() || captura.texto, categoria }
    } else if (destino === "idea") {
      payload = { destino, frente_id: frenteId ? Number(frenteId) : null }
    } else if (destino === "decision") {
      payload = { destino, frente_id: frenteId ? Number(frenteId) : null, motivo: proposito.trim() || null }
    } else {
      return
    }
    await procesarCaptura(captura.id, payload)
    await onProcesada?.()
  }

  return {
    frentes, loading,
    destino, setDestino,
    frenteId, setFrenteId,
    fecha, setFecha,
    hora, setHora,
    nombre, setNombre,
    proposito, setProposito,
    categoria, setCategoria,
    valid,
    confirmar: () => submit(false),
    descartar: () => submit(true),
  }
}
