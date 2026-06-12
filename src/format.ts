const TZ = 'America/Sao_Paulo'

export function fmtDateHeading(iso: string): string {
  const label = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    timeZone: TZ,
  }).format(new Date(iso))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function fmtDayKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { dateStyle: 'short', timeZone: TZ }).format(new Date(iso))
}

export function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(
    new Date(iso),
  )
}

export function fmtDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  }).format(new Date(iso))
}

// datetime-local trabalha no fuso do navegador
export function toLocalInput(iso: string): string {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export function fromLocalInput(value: string): string {
  return new Date(value).toISOString()
}
