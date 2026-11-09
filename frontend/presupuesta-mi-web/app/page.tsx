"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { ArrowDown, ArrowRight, BadgeCheck, Calculator, Check, Download, FileText, Globe2, LoaderCircle, Minus, Play, Plus, Sparkles } from "lucide-react"

type Servicio = { id: string; nombre: string; descripcion: string; precio: number; tipo: string; justificacion?: string }
type Propuesta = { resumen: string; servicios: Servicio[]; aclaraciones: string[]; necesidadesNoOfrecidas: string[] }
type Presupuesto = { cliente: string; fecha: string; resumen: string; servicios: Array<{ id: string; nombre: string; descripcion: string; cantidad: number; importe: number }>; aclaraciones: string[]; total: number }
type TotalManual = { base: number; paginasAdicionales: number; formulario: number; segundoIdioma: number; total: number; moneda: string }
type Caso = { nombre: string; solicitud: { tipo: string; paginas: number; formulario: boolean | string; segundoIdioma: boolean }; estado: number; total?: number }
type ResultadoCaso = { obtenido: string; correcto: boolean } | null
const CASOS: Caso[] = [
  { nombre: "Landing sencilla", solicitud: { tipo: "landing", paginas: 1, formulario: false, segundoIdioma: false }, estado: 200, total: 300 },
  { nombre: "Corporativa con formulario", solicitud: { tipo: "corporativa", paginas: 4, formulario: true, segundoIdioma: false }, estado: 200, total: 830 },
  { nombre: "Landing con extras", solicitud: { tipo: "landing", paginas: 2, formulario: true, segundoIdioma: true }, estado: 200, total: 580 },
  { nombre: "Máximo de páginas", solicitud: { tipo: "landing", paginas: 20, formulario: false, segundoIdioma: false }, estado: 200, total: 1250 },
  { nombre: "Cero páginas", solicitud: { tipo: "corporativa", paginas: 0, formulario: true, segundoIdioma: false }, estado: 400 },
  { nombre: "Más de 20 páginas", solicitud: { tipo: "corporativa", paginas: 21, formulario: true, segundoIdioma: false }, estado: 400 },
  { nombre: "Páginas decimales", solicitud: { tipo: "corporativa", paginas: 2.5, formulario: true, segundoIdioma: false }, estado: 400 },
  { nombre: "Tipo no disponible", solicitud: { tipo: "tienda", paginas: 4, formulario: true, segundoIdioma: false }, estado: 400 },
  { nombre: "Formulario con tipo incorrecto", solicitud: { tipo: "corporativa", paginas: 4, formulario: "false", segundoIdioma: false }, estado: 400 },
]
const euro = (importe: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(importe)

export default function Page() {
  const [cliente, setCliente] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [catalogo, setCatalogo] = useState<Servicio[]>([])
  const [propuesta, setPropuesta] = useState<Propuesta | null>(null)
  const [seleccion, setSeleccion] = useState<string[]>([])
  const [paginas, setPaginas] = useState("")
  const [servicioNuevo, setServicioNuevo] = useState("")
  const [nota, setNota] = useState("")
  const [presupuesto, setPresupuesto] = useState<Presupuesto | null>(null)
  const [estado, setEstado] = useState("")
  const [estadoPdf, setEstadoPdf] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const [tipoManual, setTipoManual] = useState("corporativa")
  const [paginasManual, setPaginasManual] = useState(4)
  const [formularioManual, setFormularioManual] = useState(true)
  const [idiomaManual, setIdiomaManual] = useState(false)
  const [totalManual, setTotalManual] = useState<TotalManual | null>(null)
  const [errorManual, setErrorManual] = useState("")
  const [casosResultados, setCasosResultados] = useState<ResultadoCaso[]>([])
  const [ejecutandoCasos, setEjecutandoCasos] = useState(false)
  const [estadoCasos, setEstadoCasos] = useState("")

  useEffect(() => {
    fetch("/api/propuesta/catalogo").then(async (r) => {
      if (!r.ok) throw new Error("No se pudo cargar el catálogo.")
      setCatalogo((await r.json()).servicios)
    }).catch((e) => setEstado(e.message))
  }, [])

  const payload = useMemo(() => {
    if (!propuesta) return null
    const ids = [...seleccion]
    const numeroPaginas = Number(paginas)
    if (numeroPaginas > 1 && !ids.includes("paginaAdicional")) ids.push("paginaAdicional")
    if (numeroPaginas <= 1) {
      const index = ids.indexOf("paginaAdicional")
      if (index >= 0) ids.splice(index, 1)
    }
    return { cliente, resumen: propuesta.resumen, servicios: ids, paginas: numeroPaginas, aclaraciones: [...propuesta.aclaraciones, ...propuesta.necesidadesNoOfrecidas, ...(nota.trim() ? [nota.trim()] : [])] }
  }, [cliente, nota, paginas, propuesta, seleccion])

  async function analizar() {
    setEstado("")
    if (!cliente.trim() || !descripcion.trim()) { setEstado("Indica el nombre del cliente y describe el proyecto."); return }
    setOcupado(true)
    try {
      const response = await fetch("/api/propuesta/analizar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cliente, descripcion }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detalles?.join(" ") || data.error)
      setPropuesta(data)
      const ids = data.servicios.map((s: Servicio) => s.id)
      const base = ids.includes("landing") ? "landing" : "corporativa"
      setSeleccion([...ids.filter((id: string) => id !== "landing" && id !== "corporativa"), base])
      setPaginas("")
      setPresupuesto(null)
      setEstado("")
    } catch (e) { setEstado(`${e instanceof Error ? e.message : "No se pudo analizar la solicitud."} Puedes volver a intentarlo.`) }
    finally { setOcupado(false) }
  }

  function cambiarServicio(servicio: Servicio, marcado: boolean) {
    setSeleccion((actual) => {
      if (!marcado) return actual.filter((id) => id !== servicio.id)
      const baseActualizada = servicio.tipo === "base" ? actual.filter((id) => id !== "landing" && id !== "corporativa") : actual
      return [...baseActualizada, servicio.id]
    })
    setPresupuesto(null)
  }

  async function actualizarPresupuesto() {
    if (!payload) return
    setOcupado(true)
    setEstadoPdf("Calculando con las tarifas del servidor…")
    try {
      const response = await fetch("/api/propuesta/presupuesto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detalles?.join(" ") || data.error)
      setPresupuesto(data)
      setEstadoPdf("")
    } catch (e) { setPresupuesto(null); setEstadoPdf(e instanceof Error ? e.message : "No se pudo calcular el presupuesto.") }
    finally { setOcupado(false) }
  }

  async function descargarPdf() {
    if (!payload) return
    setOcupado(true)
    setEstadoPdf("Generando PDF…")
    try {
      const response = await fetch("/api/propuesta/pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      if (!response.ok) { const data = await response.json(); throw new Error(data.detalles?.join(" ") || data.error) }
      const url = URL.createObjectURL(await response.blob())
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = "presupuesto-web.pdf"
      anchor.click()
      URL.revokeObjectURL(url)
      setEstadoPdf("Presupuesto descargado.")
    } catch (e) { setEstadoPdf(e instanceof Error ? e.message : "No se pudo generar el PDF.") }
    finally { setOcupado(false) }
  }

  async function calcularManual() {
    setErrorManual("")
    try {
      const response = await fetch("/api/presupuesto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tipo: tipoManual, paginas: paginasManual, formulario: formularioManual, segundoIdioma: idiomaManual }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detalles?.join(" ") || data.error)
      setTotalManual(data)
    } catch (e) { setTotalManual(null); setErrorManual(e instanceof Error ? e.message : "No se pudo calcular el presupuesto.") }
  }

  async function ejecutarCasos() {
    setEjecutandoCasos(true)
    setEstadoCasos("")
    const resultados: ResultadoCaso[] = []
    try {
      for (const caso of CASOS) {
        const response = await fetch("/api/presupuesto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(caso.solicitud) })
        const data = await response.json()
        const correcto = response.status === caso.estado && (caso.total === undefined || data.total === caso.total)
        resultados.push({ obtenido: response.ok ? `${response.status} · ${euro(data.total)}` : `${response.status} · solicitud rechazada`, correcto })
        setCasosResultados([...resultados])
      }
      setEstadoCasos("Comprobación terminada.")
    } catch { setEstadoCasos("No se pudieron completar los casos. Comprueba la conexión con el servidor.") }
    finally { setEjecutandoCasos(false) }
  }

  return <main className="min-h-screen bg-[#f3f7f4] text-[#18332e]">
    <header className="sticky top-0 z-20 border-b border-[#dce7e1] bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[70px] max-w-7xl items-center justify-between px-5 sm:px-8">
        <a href="/" className="flex items-center gap-3 font-semibold tracking-tight"><span className="grid size-10 place-items-center rounded-xl bg-[#174c45] text-white"><Globe2 size={19} /></span><span>presupuesta<span className="text-[#58a17e]">.</span></span></a>
        <nav className="hidden items-center gap-6 text-sm font-medium text-[#637a70] md:flex"><a className="transition hover:text-[#174c45]" href="#calculadora">Calculadora</a><a className="transition hover:text-[#174c45]" href="#propuesta">Propuesta con IA</a></nav>
        <a href="#calculadora" className="flex items-center gap-2 text-sm font-semibold text-[#34745e]">Empezar <ArrowDown size={15} /></a>
      </div>
    </header>

    <section className="relative overflow-hidden border-b border-[#dce7e1] bg-[#e9f2ec]">
      <div className="pointer-events-none absolute -right-36 -top-44 size-[460px] rounded-full border border-[#cbded1]" /><div className="pointer-events-none absolute -right-12 -top-24 size-[310px] rounded-full border border-[#cbded1]" />
      <div className="relative mx-auto grid max-w-7xl gap-9 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[1fr_370px] lg:items-center lg:py-[76px]">
        <div className="max-w-3xl">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#caddd0] bg-white/80 px-3 py-1.5 text-[11px] font-bold tracking-[.12em] text-[#39745d]"><Sparkles size={14} /> PROPUESTA A TU MEDIDA</span>
          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.08] tracking-[-.045em] text-[#173a35] sm:text-5xl lg:text-[58px]">Una buena web empieza por entender <span className="text-[#529477]">tu idea.</span></h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#5a7168] sm:text-lg">Cuéntanos qué quieres crear. Prepararemos una propuesta clara para que puedas revisarla, ajustarla y descargar tu presupuesto.</p>
          <div className="mt-7 flex flex-wrap gap-2 text-xs font-medium text-[#45685a]"><span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-2"><Check size={14} className="text-[#4c9876]" /> Tú decides los servicios</span><span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-2"><Check size={14} className="text-[#4c9876]" /> Precios calculados en servidor</span></div>
        </div>
        <aside className="rounded-2xl border border-[#d3e2d8] bg-white/80 p-5 shadow-[0_20px_55px_-35px_#174b3b66] sm:p-6">
          <p className="mb-5 text-[11px] font-bold uppercase tracking-[.15em] text-[#82948a]">Así de fácil</p>
          <ol className="space-y-5">{[["01", "Describe", "Explícanos tu proyecto con tus palabras."], ["02", "Revisa", "Ajusta los servicios y completa los datos."], ["03", "Descarga", "Previsualiza y guarda tu presupuesto PDF."]].map(([n, title, text], i) => <li key={n} className="flex gap-4"><span className={`grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold ${i === 0 ? "bg-[#174c45] text-white" : "bg-[#edf4ef] text-[#547667]"}`}>{n}</span><span><b className="block text-sm text-[#29483c]">{title}</b><span className="mt-1 block text-xs leading-5 text-[#7e8f85]">{text}</span></span></li>)}</ol>
        </aside>
      </div>
    </section>

    <section id="calculadora" className="scroll-mt-24 mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-[.15em] text-[#529477]">Opción rápida</p><h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#193b34] sm:text-3xl">Calculadora de presupuesto</h2><p className="mt-2 text-sm text-[#788980]">Selecciona las características y consulta el precio al instante.</p></div><span className="rounded-full border border-[#dce7e1] bg-white px-3 py-1.5 text-xs text-[#687e73]">Tarifas del catálogo</span></div>
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_300px]">
        <section className="rounded-2xl border border-[#dfe8e2] bg-white p-5 shadow-[0_10px_35px_-28px_#174b3b66] sm:p-7">
          <h3 className="mb-5 text-base font-semibold text-[#203e35]">Datos del proyecto</h3>
          <fieldset><legend className="mb-2 text-sm font-medium text-[#354d42]">Tipo de web</legend><div className="flex flex-wrap gap-2"><label className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-4 py-3 text-sm transition ${tipoManual === "landing" ? "border-[#63a184] bg-[#f0f7f2] text-[#28664e]" : "border-[#dce6df] text-[#60746a] hover:bg-[#f8faf8]"}`}><input type="radio" name="tipoManual" value="landing" checked={tipoManual === "landing"} onChange={() => setTipoManual("landing")} className="accent-[#34775e]" />Landing</label><label className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-4 py-3 text-sm transition ${tipoManual === "corporativa" ? "border-[#63a184] bg-[#f0f7f2] text-[#28664e]" : "border-[#dce6df] text-[#60746a] hover:bg-[#f8faf8]"}`}><input type="radio" name="tipoManual" value="corporativa" checked={tipoManual === "corporativa"} onChange={() => setTipoManual("corporativa")} className="accent-[#34775e]" />Corporativa</label></div></fieldset>
          <div className="mt-5"><label htmlFor="paginasManual" className="mb-2 block text-sm font-medium text-[#354d42]">Número de páginas (1–20)</label><div className="flex items-center gap-2"><Button variant="outline" className="size-10 rounded-lg border-[#dce6df] p-0 text-[#34745e]" aria-label="Restar página" onClick={() => setPaginasManual(Math.max(1, paginasManual - 1))}><Minus size={15} /></Button><input id="paginasManual" type="number" min={1} max={20} value={paginasManual} onChange={(e) => setPaginasManual(Math.min(20, Math.max(1, Number(e.target.value) || 1)))} className="h-10 w-20 rounded-lg border border-[#dce6df] text-center text-sm font-semibold outline-none focus:border-[#72a78c]" /><Button variant="outline" className="size-10 rounded-lg border-[#dce6df] p-0 text-[#34745e]" aria-label="Añadir página" onClick={() => setPaginasManual(Math.min(20, paginasManual + 1))}><Plus size={15} /></Button></div></div>
          <fieldset className="mt-5"><legend className="mb-2 text-sm font-medium text-[#354d42]">Opciones adicionales</legend><div className="grid gap-3 sm:grid-cols-2"><label className="flex cursor-pointer items-center gap-2.5 text-sm text-[#53695f]"><input type="checkbox" checked={formularioManual} onChange={(e) => setFormularioManual(e.target.checked)} className="size-4 accent-[#34775e]" />Formulario de contacto</label><label className="flex cursor-pointer items-center gap-2.5 text-sm text-[#53695f]"><input type="checkbox" checked={idiomaManual} onChange={(e) => setIdiomaManual(e.target.checked)} className="size-4 accent-[#34775e]" />Segundo idioma</label></div></fieldset>
          <Button className="mt-6 h-11 rounded-lg bg-[#287d78] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#206d69]" onClick={calcularManual}><Calculator size={16} className="mr-2" />Calcular presupuesto <ArrowRight size={16} className="ml-3" /></Button>
          {errorManual && <p role="status" className="mt-3 text-sm text-[#a3433a]">{errorManual}</p>}
        </section>
        <aside aria-live="polite" className="relative overflow-hidden rounded-2xl bg-[#17464b] p-6 text-white shadow-[0_18px_45px_-25px_#17464b88] sm:p-7"><div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#66ba91] to-[#d5e68d]" /><h3 className="text-sm font-semibold">Resultado</h3><p className="mt-5 text-4xl font-semibold tracking-tight text-[#c0f0d4]">{totalManual ? euro(totalManual.total) : "—"}</p>{totalManual ? <div className="mt-5 space-y-3 border-t border-white/15 pt-4 text-xs text-white/75">{[["Web base", totalManual.base], ["Páginas adicionales", totalManual.paginasAdicionales], ["Formulario", totalManual.formulario], ["Segundo idioma", totalManual.segundoIdioma]].map(([label, amount]) => <div key={String(label)} className="flex justify-between gap-3"><span>{label}</span><b className="text-white">{euro(Number(amount))}</b></div>)}</div> : <p className="mt-5 border-t border-white/15 pt-3 text-xs text-white/75">El resultado aparecerá aquí.</p>}</aside>
      </div>

      <section className="mt-5 rounded-2xl border border-[#dfe8e2] bg-white p-5 shadow-[0_10px_35px_-28px_#174b3b66] sm:p-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-base font-semibold text-[#203e35]">Casos de prueba</h3><p className="mt-1 text-xs text-[#819087]">Ejecuta los nueve ejemplos y compara el resultado del servidor.</p></div><Button variant="outline" className="h-10 rounded-lg border-[#d7e3dc] text-[#386d59] hover:bg-[#f2f8f4]" disabled={ejecutandoCasos} onClick={ejecutarCasos}>{ejecutandoCasos ? <LoaderCircle size={15} className="mr-2 animate-spin" /> : <Play size={14} className="mr-2" />}Ejecutar los 9 casos</Button></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[650px] border-collapse text-left text-xs"><thead><tr className="border-b border-[#e5ece7] text-[#687e73]"><th className="px-2 py-3 font-semibold">Caso</th><th className="px-2 py-3 font-semibold">Solicitud</th><th className="px-2 py-3 font-semibold">Esperado</th><th className="px-2 py-3 font-semibold">Obtenido</th><th className="px-2 py-3 font-semibold">Resultado</th></tr></thead><tbody>{CASOS.map((caso, i) => { const result = casosResultados[i]; const esperado = caso.estado === 200 ? `200 · ${euro(caso.total || 0)}` : "400 · solicitud inválida"; return <tr key={caso.nombre} className="border-b border-[#edf1ee] last:border-0"><td className="px-2 py-3 font-medium text-[#344b40]">{caso.nombre}</td><td className="px-2 py-3 text-[#788980]">{caso.solicitud.tipo}, {caso.solicitud.paginas} pág.</td><td className="px-2 py-3 text-[#788980]">{esperado}</td><td className="px-2 py-3 text-[#788980]">{result?.obtenido || "—"}</td><td className={`px-2 py-3 font-semibold ${result ? result.correcto ? "text-[#34825e]" : "text-[#b7483f]" : "text-[#9aa79f]"}`}>{result ? result.correcto ? "Correcto" : "Revisar" : "Pendiente"}</td></tr>})}</tbody></table></div>
        {estadoCasos && <p role="status" className="mt-3 text-xs text-[#71847a]">{estadoCasos}</p>}
      </section>
    </section>

    <div id="propuesta" className="scroll-mt-20 border-t border-[#dce7e1] bg-[#f8faf8]">
    <div className="mx-auto max-w-7xl px-5 py-9 sm:px-8 sm:py-12">
      <div className="mb-6 flex items-end justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-[.15em] text-[#529477]">Propuesta personalizada</p><h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#193b34]">¿Necesitas algo más a medida?</h2><p className="mt-2 text-sm text-[#788980]">Describe tu proyecto y recibe una selección de servicios que podrás modificar.</p></div>{propuesta && <span className="hidden rounded-full bg-[#e2f0e7] px-3 py-1.5 text-xs font-semibold text-[#38765d] sm:inline-flex">Propuesta preparada</span>}</div>
      <div className="grid gap-5 xl:grid-cols-[.88fr_1.12fr]">
        <section id="solicitud" className="scroll-mt-24 rounded-2xl border border-[#dfe8e2] bg-white p-5 shadow-[0_10px_35px_-28px_#174b3b66] sm:p-7">
          <div className="mb-6 flex items-start justify-between gap-3"><div><span className="mb-3 grid size-10 place-items-center rounded-xl bg-[#edf5ef] text-[#397960]"><FileText size={18} /></span><h3 className="text-lg font-semibold text-[#203e35]">Tu solicitud</h3><p className="mt-1 text-sm text-[#7b8a82]">Un poco de contexto nos ayuda a afinar la propuesta.</p></div><span className="rounded-full bg-[#f1f5f2] px-2.5 py-1 text-[10px] font-bold tracking-wider text-[#77877f]">PASO 1</span></div>
          <div className="space-y-5">
            <div><label className="mb-2 block text-sm font-medium text-[#354d42]" htmlFor="cliente">Nombre del cliente o empresa</label><input id="cliente" maxLength={120} value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Ej.: Restaurante La Plaza" className="h-11 w-full rounded-lg border border-[#dce6df] bg-[#fbfcfb] px-3.5 text-sm outline-none transition placeholder:text-[#a1ada6] focus:border-[#72a78c] focus:bg-white focus:ring-4 focus:ring-[#72a78c]/10" /></div>
            <div><div className="mb-2 flex items-center justify-between gap-2"><label className="text-sm font-medium text-[#354d42]" htmlFor="descripcion">¿Qué necesitas para tu web?</label><span className="text-[11px] text-[#95a29b]">{descripcion.length}/4000</span></div><textarea id="descripcion" maxLength={4000} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Por ejemplo: necesito una web para mi restaurante, quiero mostrar la carta, recibir reservas y ofrecerla en dos idiomas…" className="min-h-40 w-full resize-y rounded-lg border border-[#dce6df] bg-[#fbfcfb] px-3.5 py-3 text-sm leading-6 outline-none transition placeholder:text-[#a1ada6] focus:border-[#72a78c] focus:bg-white focus:ring-4 focus:ring-[#72a78c]/10" /><p className="mt-2 text-xs leading-5 text-[#929f97]">No hacen falta términos técnicos. Escríbelo como se lo explicarías a una persona.</p></div>
            <Button className="h-11 w-full rounded-lg bg-[#174c45] text-sm font-semibold text-white shadow-sm hover:bg-[#103d38]" disabled={ocupado} onClick={analizar}>{ocupado ? <><LoaderCircle size={16} className="mr-2 animate-spin" />Preparando propuesta…</> : <><Sparkles size={16} className="mr-2" />Preparar propuesta <ArrowRight size={16} className="ml-auto" /></>}</Button>
          </div>
          {estado && <p role="status" className="mt-4 rounded-lg border border-[#f0d6d2] bg-[#fff7f5] px-3.5 py-3 text-sm text-[#a3433a]">{estado}</p>}
          <div className="mt-5 flex items-start gap-2 border-t border-[#edf1ed] pt-4 text-xs leading-5 text-[#89968f]"><BadgeCheck size={15} className="mt-0.5 shrink-0 text-[#70a087]" />Usa datos ficticios durante las pruebas.</div>
        </section>

        <section className="rounded-2xl border border-[#dfe8e2] bg-white p-5 shadow-[0_10px_35px_-28px_#174b3b66] sm:p-7">
          <div className="mb-5 flex items-start justify-between gap-3"><div><span className="mb-3 grid size-10 place-items-center rounded-xl bg-[#edf5ef] text-[#397960]"><Sparkles size={18} /></span><h3 className="text-lg font-semibold text-[#203e35]">Servicios recomendados</h3><p className="mt-1 text-sm text-[#7b8a82]">Puedes aceptar, quitar o añadir servicios.</p></div><span className="rounded-full bg-[#f1f5f2] px-2.5 py-1 text-[10px] font-bold tracking-wider text-[#77877f]">PASO 2</span></div>
          {!propuesta ? <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed border-[#dce6df] bg-[#fbfcfb] px-5 text-center"><span className="mb-3 grid size-12 place-items-center rounded-full bg-white text-[#729787] shadow-sm"><Sparkles size={20} /></span><p className="text-sm font-medium text-[#53695f]">Tu propuesta aparecerá aquí</p><p className="mt-1 max-w-xs text-xs leading-5 text-[#98a49d]">Describe tu idea y relacionaremos tus necesidades con los servicios disponibles.</p></div> : <>
            <div className="mb-4 rounded-xl border border-[#d9e8df] bg-[#f2f8f4] p-4"><p className="mb-1 text-[10px] font-bold uppercase tracking-[.13em] text-[#639077]">Resumen del proyecto</p><p className="text-sm leading-6 text-[#39564a]">{propuesta.resumen}</p></div>
            <div className="max-h-[420px] divide-y divide-[#edf1ee] overflow-y-auto pr-1">{catalogo.map((s) => { const marcada = seleccion.includes(s.id); const justificacion = propuesta.servicios.find((x) => x.id === s.id)?.justificacion; return <label key={s.id} className={`flex cursor-pointer gap-3 rounded-lg px-2.5 py-3.5 transition ${marcada ? "bg-[#f7faf8]" : "hover:bg-[#fafcfb]"}`}><input type="checkbox" checked={marcada} onChange={(e) => cambiarServicio(s, e.target.checked)} className="mt-1 size-4 shrink-0 accent-[#34775e]" /><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"><b className="text-sm font-semibold text-[#30483d]">{s.nombre}</b><span className="text-xs font-semibold text-[#4e7865]">{euro(s.precio)}{s.tipo === "cantidad" ? " / unidad" : ""}</span></span><span className="mt-1 block text-xs leading-5 text-[#7d8a82]">{s.descripcion}</span>{justificacion && <span className="mt-2 block border-l-2 border-[#91b9a2] pl-2 text-xs leading-5 text-[#58806b]">{justificacion}</span>}</span></label>})}</div>
            <div className="mt-3 flex flex-col gap-2 border-t border-[#edf1ee] pt-4 sm:flex-row"><select aria-label="Añadir servicio" value={servicioNuevo} onChange={(e) => setServicioNuevo(e.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-[#dce6df] bg-white px-3 text-sm text-[#53695f] outline-none focus:border-[#72a78c]"><option value="">Añadir otro servicio…</option>{catalogo.filter((s) => !seleccion.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select><Button variant="outline" className="h-10 rounded-lg border-[#d7e3dc] text-[#386d59] hover:bg-[#f2f8f4]" onClick={() => { const servicio = catalogo.find((s) => s.id === servicioNuevo); if (servicio) cambiarServicio(servicio, true); setServicioNuevo("") }}><Plus size={15} className="mr-1.5" />Añadir</Button></div>
            <div className="mt-5 rounded-xl bg-[#f7f9f7] p-4"><label htmlFor="paginas" className="mb-2 block text-sm font-medium text-[#354d42]">¿Cuántas páginas tendrá?</label><input id="paginas" type="number" min={1} max={20} value={paginas} onChange={(e) => { setPaginas(e.target.value); setPresupuesto(null) }} placeholder="Por ejemplo, 4" className="h-10 w-full rounded-lg border border-[#dce6df] bg-white px-3 text-sm outline-none focus:border-[#72a78c] focus:ring-4 focus:ring-[#72a78c]/10" /><p className="mt-2 text-xs leading-5 text-[#87948c]">La primera página está incluida. Cada página adicional cuesta 50 €.</p></div>
          </>}
        </section>

        {propuesta && <section className="scroll-mt-24 rounded-2xl border border-[#dfe8e2] bg-white p-5 shadow-[0_10px_35px_-28px_#174b3b66] xl:col-span-2 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><span className="mb-3 grid size-10 place-items-center rounded-xl bg-[#edf5ef] text-[#397960]"><FileText size={18} /></span><h3 className="text-lg font-semibold text-[#203e35]">Revisa tu presupuesto</h3><p className="mt-1 text-sm text-[#7b8a82]">Comprueba las partidas y el total antes de descargarlo.</p></div><span className="rounded-full bg-[#f1f5f2] px-2.5 py-1 text-[10px] font-bold tracking-wider text-[#77877f]">PASO 3</span></div>
          <label htmlFor="nota" className="mb-2 mt-5 block text-sm font-medium text-[#354d42]">Aclaraciones para incluir (opcional)</label><textarea id="nota" maxLength={1000} value={nota} onChange={(e) => { setNota(e.target.value); setPresupuesto(null) }} placeholder="Añade una nota que quieras dejar por escrito…" className="mb-4 min-h-20 w-full resize-y rounded-lg border border-[#dce6df] bg-[#fbfcfb] px-3.5 py-3 text-sm outline-none placeholder:text-[#a1ada6] focus:border-[#72a78c] focus:bg-white focus:ring-4 focus:ring-[#72a78c]/10" />
          <div className="flex flex-wrap items-center gap-3"><Button variant="outline" className="h-10 rounded-lg border-[#d7e3dc] text-[#386d59] hover:bg-[#f2f8f4]" disabled={ocupado} onClick={actualizarPresupuesto}>{ocupado ? <LoaderCircle size={15} className="mr-2 animate-spin" /> : <FileText size={15} className="mr-2" />}Actualizar vista previa</Button><Button className="h-10 rounded-lg bg-[#174c45] px-5 text-white hover:bg-[#103d38]" disabled={ocupado || !presupuesto} onClick={descargarPdf}><Download size={15} className="mr-2" />Descargar presupuesto PDF</Button>{estadoPdf && <p role="status" className="text-sm text-[#688076]">{estadoPdf}</p>}</div>
          {presupuesto && <div className="mt-6 grid gap-6 rounded-xl border border-[#dfe8e2] bg-[#fbfcfb] p-5 md:grid-cols-[1fr_220px] sm:p-6"><div><div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#829189]">Presupuesto para</p><b className="mt-1 block text-base text-[#29443a]">{presupuesto.cliente}</b></div><span className="rounded-full border border-[#e2e9e4] bg-white px-3 py-1.5 text-xs text-[#75847c]">{presupuesto.fecha}</span></div><p className="mb-4 text-sm leading-6 text-[#66776e]">{presupuesto.resumen}</p><div className="divide-y divide-[#e8eeea] border-y border-[#e8eeea]">{presupuesto.servicios.map((s) => <div key={s.id} className="flex justify-between gap-4 py-3 text-sm"><span><b className="text-[#344b40]">{s.nombre}{s.cantidad > 1 ? ` × ${s.cantidad}` : ""}</b><span className="mt-1 block text-xs text-[#87948d]">{s.descripcion}</span></span><b className="whitespace-nowrap text-[#3e6153]">{euro(s.importe)}</b></div>)}</div>{presupuesto.aclaraciones.length > 0 && <div className="mt-4 text-sm"><b className="text-[#40594d]">Aclaraciones y pendientes</b><ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-[#6d7f75]">{presupuesto.aclaraciones.map((a, i) => <li key={i}>{a}</li>)}</ul></div>}</div><aside className="flex flex-col justify-between rounded-xl bg-[#eaf3ee] p-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#648576]">Total estimado</p><p className="mt-2 text-3xl font-semibold tracking-tight text-[#174c45]">{euro(presupuesto.total)}</p><p className="mt-2 text-xs leading-5 text-[#748a7f]">Calculado con las tarifas actuales del catálogo.</p></div><div className="mt-5 flex items-center gap-2 border-t border-[#d6e5dc] pt-4 text-xs font-medium text-[#47715e]"><BadgeCheck size={16} />Importes verificados</div></aside></div>}
        </section>}
      </div>
      <footer className="mt-8 flex flex-col gap-2 border-t border-[#dce7e1] pt-5 text-xs text-[#89978f] sm:flex-row sm:items-center sm:justify-between"><span>Presupuesta mi web · Una propuesta clara para empezar.</span><span className="inline-flex items-center gap-1.5"><BadgeCheck size={13} />Servicios e importes validados por el servidor</span></footer>
    </div>
    </div>
  </main>
}
