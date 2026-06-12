import DatePicker, { registerLocale } from 'react-datepicker'
import { ptBR } from 'date-fns/locale'
import 'react-datepicker/dist/react-datepicker.css'

registerLocale('pt-BR', ptBR)

// 16h é o primeiro horário com jogos na Copa 2026 (horário de Brasília)
const DEFAULT_HOUR = 16

function withTime(date: Date, time: Date | null): Date {
  const d = new Date(date)
  d.setHours(time ? time.getHours() : DEFAULT_HOUR, time ? time.getMinutes() : 0, 0, 0)
  return d
}

// Data e hora em campos separados: calendário abre na data digitada ou hoje;
// escolher uma data sem hora assume 16h00. Digitação em formato brasileiro.
export function DateTimeField({
  value,
  onChange,
  placeholder = 'dd/mm/aaaa',
}: {
  value: Date | null
  onChange: (d: Date | null) => void
  placeholder?: string
}) {
  return (
    <span className="datetime-field">
      <DatePicker
        selected={value}
        onChange={(d: Date | null) => onChange(d ? withTime(d, value) : null)}
        locale="pt-BR"
        dateFormat="dd/MM/yyyy"
        placeholderText={placeholder}
        openToDate={value ?? new Date()}
      />
      <DatePicker
        selected={value}
        onChange={(t: Date | null) => onChange(t ? withTime(value ?? new Date(), t) : value && withTime(value, null))}
        locale="pt-BR"
        showTimeSelect
        showTimeSelectOnly
        timeIntervals={15}
        timeCaption="Hora"
        dateFormat="HH:mm"
        placeholderText="--:--"
      />
    </span>
  )
}
