const EXPLANATION =
  'Palpite fora do prazo: foi registrado depois do início do jogo, por isso não vale pontos.'

// selinho com explicação no hover (desktop) e no toque (celular)
export function IgnoredTag() {
  return (
    <button className="ignored-tag" title={EXPLANATION} onClick={() => alert(EXPLANATION)}>
      ⏱ fora do prazo
    </button>
  )
}
