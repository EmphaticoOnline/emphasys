"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Lightbulb, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { createIdea, listFrentes, listIdeas, updateIdea, type Frente, type Idea, type IdeaCreate, type IdeaEstado } from "../../../services/compassService"
import { ConvertirIdeaDialog } from "./convertir-idea-dialog"
import { CrearIdeaDialog } from "./crear-idea-dialog"
import { IdeaCard } from "./idea-card"

const TODOS_LOS_ESTADOS_FRENTE = ["activo", "pausado", "completado", "archivado"] as const

export function IdeasView() {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [frentes, setFrentes] = useState<Frente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [tab, setTab] = useState<IdeaEstado>("activa")
  const [creating, setCreating] = useState(false)
  const [convirtiendo, setConvirtiendo] = useState<Idea | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true); setError("")
      const [i, f] = await Promise.all([listIdeas(), listFrentes([...TODOS_LOS_ESTADOS_FRENTE])])
      setIdeas(i); setFrentes(f)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron cargar las Ideas")
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void load() }, [load])

  const activas = useMemo(() => ideas.filter((i) => i.estado === "activa"), [ideas])
  const archivadas = useMemo(() => ideas.filter((i) => i.estado === "archivada"), [ideas])
  const visibles = tab === "activa" ? activas : archivadas

  async function crear(payload: IdeaCreate) {
    await createIdea(payload)
    await load()
  }

  async function archivar(idea: Idea) {
    await updateIdea(idea.id, { estado: idea.estado === "activa" ? "archivada" : "activa" })
    await load()
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="rounded-2xl bg-gradient-to-b from-[var(--surface-header)] to-[var(--surface-header-end)] px-5 py-4 md:px-8 md:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex max-w-lg flex-col gap-1">
            <h1 className="font-editorial text-4xl leading-[0.95] tracking-tight text-foreground md:text-5xl">Ideas</h1>
            <p className="mt-0.5 font-editorial text-lg text-pretty text-muted-foreground italic">Una posibilidad, no un compromiso.</p>
          </div>
          <Button onClick={() => setCreating(true)} className="min-h-11 md:min-h-9"><Plus />Nueva idea</Button>
        </div>
      </header>

      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-card px-5 py-5">
          <p className="font-editorial text-lg text-destructive">No pudimos cargar tus ideas</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" className="mt-3" onClick={() => void load()}>Reintentar</Button>
        </div>
      )}

      {!error && loading && ideas.length === 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-[150px] animate-pulse rounded-2xl border border-border bg-[var(--surface-sunken)]" />)}
        </div>
      )}

      {!error && !(loading && ideas.length === 0) && (
        <>
          <div className="flex items-center gap-2 rounded-2xl bg-[var(--surface-sunken)] p-1.5" role="tablist" aria-label="Filtrar Ideas">
            {(["activa", "archivada"] as const).map((key) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`min-h-10 flex-1 rounded-xl px-4 text-sm font-semibold sm:flex-none ${tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {key === "activa" ? "Activas" : "Archivadas"}
                <span className="ml-2 font-mono-compass text-[11px] opacity-60">{key === "activa" ? activas.length : archivadas.length}</span>
              </button>
            ))}
          </div>

          {visibles.length === 0 ? (
            <Empty className="rounded-2xl bg-[var(--surface-sunken)] py-8">
              <EmptyHeader>
                <EmptyMedia variant="icon"><Lightbulb /></EmptyMedia>
                <EmptyTitle className="font-editorial text-xl font-normal">
                  {tab === "activa" ? "Ninguna idea activa ahora mismo" : "Todavía no archivaste ninguna idea"}
                </EmptyTitle>
                <EmptyDescription>Anota lo que podría ser. No hace falta decidir nada ahora.</EmptyDescription>
              </EmptyHeader>
              {tab === "activa" && (
                <EmptyContent>
                  <Button onClick={() => setCreating(true)}><Plus />Nueva idea</Button>
                </EmptyContent>
              )}
            </Empty>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
              {visibles.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  frentes={frentes}
                  onConvertir={() => setConvirtiendo(idea)}
                  onArchivar={() => void archivar(idea)}
                  onReactivar={() => void archivar(idea)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {creating && <CrearIdeaDialog frentes={frentes} onClose={() => setCreating(false)} onCreate={crear} />}
      {convirtiendo && (
        <ConvertirIdeaDialog
          idea={convirtiendo}
          onClose={() => setConvirtiendo(null)}
          onConverted={async () => { setConvirtiendo(null); setTab("archivada"); await load() }}
        />
      )}
    </div>
  )
}
