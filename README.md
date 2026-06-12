# ⚽ Bolão da Família — Copa do Mundo 2026

Bolão privado para a família, inspirado no Nubolão. React + Vite na Vercel, Serverless Functions, Neon Postgres, login só com Google.

## Regras

- Palpite a qualquer momento; palpites feitos **após o início do jogo são ignorados** (validação a posteriori, quando o resultado é lançado).
- Placar exato = **5 pts** · acertou vencedor/empate = **2 pts**.
- Placar considera **prorrogação, sem pênaltis**; empate é palpite válido em qualquer fase.
- Desempate no ranking: mais placares exatos.
- Palpites dos outros só aparecem depois que a bola rola.
- Novo usuário entra como pendente até o admin aprovar.

## Variáveis de ambiente (Vercel → Settings → Environment Variables)

| Variável | Valor |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Client ID do OAuth (Google Cloud Console) |
| `ADMIN_EMAIL` | e-mail Google do administrador |
| `DATABASE_URL` | injetada pela integração Neon |

## Setup do banco

```bash
npm install
DATABASE_URL='postgres://...' npm run db:push   # cria as tabelas
DATABASE_URL='postgres://...' npm run db:seed   # carrega os 104 jogos
```

O seed lê `db/matches-source.json` (feed de fixturedownload.com). Pode rodar de novo durante a Copa para atualizar os confrontos do mata-mata — para renovar o feed antes:

```bash
curl -sL "https://fixturedownload.com/feed/json/fifa-world-cup-2026" -o db/matches-source.json
```

Atenção: o re-seed sobrescreve edições manuais de time/horário feitas no admin (placares lançados são mantidos, a menos que o feed também tenha placar).

## Desenvolvimento local

```bash
npm run dev          # frontend em http://localhost:5173
npx vercel dev       # (opcional) API em :3000 — o Vite faz proxy de /api
```

## Deploy

Push na `main` → deploy automático na Vercel. Domínio: `copa.eleprograma.com.br` (CNAME `copa` → `cname.vercel-dns.com` no Registro.br).
