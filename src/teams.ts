const PT_NAMES: Record<string, string> = {
  'South Africa': 'África do Sul',
  Germany: 'Alemanha',
  Algeria: 'Argélia',
  'Saudi Arabia': 'Arábia Saudita',
  Argentina: 'Argentina',
  Australia: 'Austrália',
  Austria: 'Áustria',
  Belgium: 'Bélgica',
  'Bosnia and Herzegovina': 'Bósnia',
  Brazil: 'Brasil',
  'Cabo Verde': 'Cabo Verde',
  Canada: 'Canadá',
  Qatar: 'Catar',
  Colombia: 'Colômbia',
  'Congo DR': 'RD Congo',
  'Korea Republic': 'Coreia do Sul',
  "Côte d'Ivoire": 'Costa do Marfim',
  Croatia: 'Croácia',
  Curaçao: 'Curaçao',
  Czechia: 'Tchéquia',
  Ecuador: 'Equador',
  Egypt: 'Egito',
  England: 'Inglaterra',
  Scotland: 'Escócia',
  Spain: 'Espanha',
  USA: 'Estados Unidos',
  France: 'França',
  Ghana: 'Gana',
  Haiti: 'Haiti',
  'IR Iran': 'Irã',
  Iraq: 'Iraque',
  Japan: 'Japão',
  Jordan: 'Jordânia',
  Morocco: 'Marrocos',
  Mexico: 'México',
  Netherlands: 'Holanda',
  'New Zealand': 'Nova Zelândia',
  Norway: 'Noruega',
  Panama: 'Panamá',
  Paraguay: 'Paraguai',
  Portugal: 'Portugal',
  Senegal: 'Senegal',
  Sweden: 'Suécia',
  Switzerland: 'Suíça',
  Tunisia: 'Tunísia',
  Türkiye: 'Turquia',
  Uruguay: 'Uruguai',
  Uzbekistan: 'Uzbequistão',
  'To be announced': 'A definir',
}

// seleção de verdade (exclui placeholders do mata-mata como 1A, 3ABCDF, "To be announced")
export function isRealTeam(raw: string): boolean {
  return raw in PT_NAMES && raw !== 'To be announced'
}

export function teamName(raw: string): string {
  if (PT_NAMES[raw]) return PT_NAMES[raw]
  const seed = raw.match(/^([12])([A-L])$/)
  if (seed) return `${seed[1]}º do Grupo ${seed[2]}`
  if (/^3[A-L]{2,}$/.test(raw)) return `3º (${raw.slice(1).split('').join('/')})`
  return raw
}
