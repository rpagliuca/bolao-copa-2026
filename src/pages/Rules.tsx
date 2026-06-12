export default function Rules() {
  return (
    <div>
      <div className="card">
        <h3>⚽ Como funciona</h3>
        <p>
          Cada um dá <strong>um palpite de placar por jogo</strong> da Copa. Pode palpitar e alterar quando
          quiser — mas só vale se for <strong>antes de a bola rolar</strong>. O placar do palpite é o do fim do
          jogo, <strong>contando prorrogação e SEM pênaltis</strong> — ou seja, cravar o empate no mata-mata
          vale, mesmo que um time avance nos pênaltis.
        </p>
      </div>

      <div className="card">
        <h3>🏆 Pontuação</h3>
        <ul className="rules-list">
          <li>
            <strong>Placar exato → 5 pontos</strong> 🎯 (e uma surpresa quando você abrir o app, após o jogo,
            pode esperar)
          </li>
          <li>
            <strong>Acertou o resultado</strong> (vencedor ou empate, sem cravar o placar) → <strong>2 pontos</strong>
          </li>
          <li>Errou tudo → 0 pontos e zoeira no grupo</li>
        </ul>
        <p>
          <strong>Desempate no ranking:</strong> quem tiver mais placares exatos fica na frente.
        </p>
      </div>

      <div className="card">
        <h3>⏱ Palpites fora do prazo</h3>
        <p>
          O app deixa registrar palpite a qualquer momento, até depois que o jogo começou — mas palpite com
          horário <strong>igual ou posterior ao início do jogo</strong> ganha o selinho{' '}
          <span className="ignored-tag">⏱ fora do prazo</span> e <strong>não vale pontos</strong>. A conferência
          é automática quando o resultado é lançado.
        </p>
      </div>

      <div className="card">
        <h3>👀 Palpites públicos</h3>
        <p>
          Aqui não tem segredo: <strong>todos os palpites são públicos o tempo todo</strong>, inclusive antes do
          jogo. Espiar o palpite dos outros é permitido e incentivado. Copiar não é recomendado rsrsrs — mas se
          copiar, todo mundo vai ver que você copiou. 😏
        </p>
        <p>E pode reagir com emoji no palpite da galera: 🤡 para o palpite do cunhado, 🍀 para o da vovó.</p>
      </div>

      <div className="card">
        <h3>🛡️ Admins e transparência</h3>
        <p>
          Os admins lançam os resultados dos jogos e podem <strong>registrar palpites retroativos</strong> em
          nome de alguém — por exemplo, quem mandou o palpite no WhatsApp antes do jogo mas não conseguiu entrar
          no app a tempo.
        </p>
        <p>
          Para ninguém desconfiar de marmelada: <strong>toda ação de admin fica registrada</strong> — mudança de
          resultado, palpite lançado ou corrigido, tudo. É só clicar no reloginho 🕘 que aparece em cada jogo e
          em cada palpite para ver o histórico completo de alterações, com autor, data e o que mudou.
        </p>
      </div>

      <div className="card">
        <h3>🚪 Acesso</h3>
        <p>
          Login com conta Google. Quem entra pela primeira vez fica como <strong>pendente</strong> até um admin
          aprovar — só família e agregados aprovados participam. 😄
        </p>
      </div>
    </div>
  )
}
