# SexPapo: arquitetura

## Revisão (versão atual, sem VPS)

Por decisão do dono, a primeira versão roda em **hospedagem Node.js da Hostinger**, sem VPS:

| Plano original (abaixo) | Versão atual |
|---|---|
| Monorepo + servidor Socket.IO separado | **Um único app Next.js** na raiz (a Hostinger detecta e faz o build) |
| PostgreSQL | **MySQL** (o banco que a Hostinger oferece), via Prisma: [`prisma/schema.prisma`](../prisma/schema.prisma) |
| Redis (presença, rate-limit, pub/sub) | Presença em tabela (`RoomPresence`, heartbeat); rate-limit em memória + checagem de flood no banco |
| WebSocket | **Polling HTTP** (chat a cada 2s, PV a cada 3s, pausa com a aba oculta), sem dependência de WebSocket |
| Cloudflare R2 | **Disco local** (`UPLOAD_DIR`) por padrão, ou **S3/R2** com `STORAGE_DRIVER=s3` (`src/server/storage.ts`). O bucket fica privado e as mídias continuam saindo por `/api/media` com as regras de acesso. `npm run storage:to-s3` migra o que já está no disco |
| Gateways (Segpay, CCBill…) | **Pix manual** com QR Code (BR Code com valor e identificador) e aprovação no admin. `Payment.provider` permite plugar gateway depois |
| — | **Perfil assinante** (`User.vipUntil` + `Subscription`): só assinante assiste vídeos |
| — | **Feed** estilo Sexlog (posts, fotos, vídeo, reações, comentários) |
| Servidor de mídia para lives | **Ao vivo via WebRTC P2P**: o vídeo vai direto do navegador de quem transmite para cada espectador (até `LIVE_MAX_VIEWERS`). A sinalização (offer/answer sem trickle) passa pela tabela `LiveSignal` no mesmo polling do chat. O servidor nunca recebe nem grava o vídeo |

### Ao vivo (`/ao-vivo`)

- **Quem transmite:** só **assinantes verificados** (admin e staff também podem). Se a assinatura vence durante a live, ela é encerrada. Uma transmissão por vez. Quem transmite aceita as regras: 18+, consentimento e nada de local público.
- **Quem assiste:** todos os membros logados, ou só assinantes, conforme a escolha de quem transmite. Bloqueios e remoções são respeitados.
- **Vídeo:** usa `getUserMedia` com resolução até 960×540 a 24 fps e ~700 kbps por espectador. Quem transmite envia uma cópia para cada espectador, então o limite depende do upload dessa pessoa (padrão 10). Quem passa do limite continua no chat e recebe o vídeo quando abre vaga. O espectador vê uma marca d'água com o próprio nick passeando pelo vídeo.
- **Rede:** STUN público por padrão. Em redes móveis com CGNAT, parte das conexões só funciona com **TURN**: configure `LIVE_TURN_URLS`, `LIVE_TURN_USERNAME` e `LIVE_TURN_CREDENTIAL`.
- **Gorjetas:** tipo `TIP` no ledger. A transação debita quem dá e credita quem transmite, com taxa opcional (`LIVE_TIP_FEE_PCT`) para `SYSTEM_SINK`. Na mesma transação somam o total e a meta, entram no ranking "quem mais apoiou" e aparecem animadas no chat. É idempotente pela chave do cliente.
- **Moderação:**
  - Quem transmite apaga mensagens e remove espectadores.
  - Staff encerra pelo player ou em **Admin → Ao vivo**.
  - Denúncias usam o tipo `LIVE`.
  - Sem heartbeat por 25 s, a transmissão é encerrada automaticamente.
- **Escala futura:** para centenas de espectadores por live, troque o P2P por um SFU (LiveKit, mediasoup) numa VPS ou por um serviço gerenciado. Antes, confira se os termos desse serviço aceitam conteúdo adulto. Só `LiveRoom.tsx` e a rota `signal` mudam.

O restante do documento é o plano original e continua valendo como caminho de migração para VPS quando o volume pedir.

---

## 1. Visão geral

```
                    ┌──────────────── VPS (Docker Compose) ────────────────┐
 navegador ──HTTPS──▶ Caddy (TLS automático, proxy reverso)                 │
                    │   ├── /            → web       (Next.js, SSR + API)   │
                    │   └── /socket.io/  → realtime  (Socket.IO, N réplicas)│
                    │                                                       │
                    │  web ─┬─ PostgreSQL 16 (Prisma)                       │
                    │  realtime ─┤                                          │
                    │  worker ───┴─ Redis 7 (presença, rate-limit, pub/sub, │
                    │                  filas BullMQ, adapter do Socket.IO)  │
                    └───────────────────────────────────────────────────────┘
                              │
                              └── Cloudflare R2 (bucket privado, URLs assinadas)
```

| Serviço | O que faz |
|---|---|
| `web` | Next.js 15 (App Router): páginas, Route Handlers (REST), auth, loja, admin, webhooks de pagamento |
| `realtime` | Servidor Socket.IO separado: salas, PV, digitando, presença, moderação ao vivo. `@socket.io/redis-adapter` permite escalar horizontalmente |
| `worker` | BullMQ: varredura de mídia (hash/CSAM), blur e marca d'água, expiração de itens, recibos por e-mail, export/exclusão LGPD, expurgo de logs de 6 meses |
| `postgres` / `redis` | Dados / estado efêmero |

**Por que o Socket.IO fica fora do Next:** conexões longas não combinam com o ciclo de vida do Next. Separado, ele escala sozinho e reinicia sem derrubar o site.

## 2. Monorepo (pnpm workspaces + Turborepo)

```
apps/
  web/             Next.js + Tailwind (tema preto/vinho/dourado, mobile-first)
  realtime/        Socket.IO + handlers tipados
  worker/          jobs BullMQ
packages/
  db/              schema Prisma, client, seed, migrations SQL extras (triggers do ledger, partições)
  shared/          schemas Zod, tipos de eventos do socket, matriz de permissões, compilador de estilos de itens
  payments/        interface PaymentProvider + adapters (fake, gateways escolhidos)
  auth/            sessões, argon2id, TOTP, age gate
  ui/              componentes (Nick estilizado, balões, painel de online)
infra/
  docker-compose.yml, Caddyfile, backups do postgres
docs/
```

## 3. Decisões técnicas principais

### Auth e sessões
- Senha com **argon2id**; login Google via OAuth (Arctic/Lucia-style, sem NextAuth, para controlar cookies e sessões).
- Sessão: token aleatório em cookie `httpOnly; Secure; SameSite=Lax`; só o **sha256** vai para o banco. O socket autentica com o mesmo cookie no handshake.
- CSRF: SameSite + checagem de `Origin` em toda mutação + token double-submit nos formulários.
- 2FA TOTP opcional, com o segredo cifrado (AES-GCM, chave em env).
- `deviceId` em cookie persistente, usado para banimento por dispositivo.

### Age gate e verificação (em camadas)
1. **Age gate** na primeira visita (interstitial 18+, sem conteúdo antes do aceite).
2. **Data de nascimento** obrigatória no cadastro; menor de 18 é recusado. Casal: data das **duas** pessoas (`ProfilePerson`), ambas 18+.
3. **Verificação de idade** (selfie com gesto sorteado, revisada por moderador; casal aparece junto) é **pré-requisito** para: enviar/ver mídia, PV, compras e criar sala.
4. Middleware central `requireAgeVerified()` usado no web e no realtime. É testado.

> ⚠️ **ECA Digital (Lei 15.211/2025)** exige mecanismos confiáveis de verificação de idade para conteúdo adulto e **veda a autodeclaração**. Minha recomendação: além da selfie com gesto, preparar um provedor de verificação de idade/documento (ex.: idwall, unico, Serpro Datavalid) atrás de uma interface `AgeVerifier`. **Valide com um advogado** se texto e salas públicas podem ficar liberados só com o age gate.

### Salas e permissões
- Rota `/[slug]` com lista de slugs reservados (`admin`, `api`, `loja`, `login`, …).
- Matriz de permissões pura em `packages/shared/permissions.ts`, no formato `can(actor, action, room, target)`. Web e realtime usam a mesma função, e ela é coberta por testes.
- Hierarquia: Dono > Moderador > Membro > Convidado. Ninguém age sobre quem está no mesmo cargo ou acima. Admin e moderador da plataforma passam por cima de tudo.
- Estado quente no Redis: online por sala (`ZSET` com score = cargo×10⁶ + poder), mute ativo, slow-mode e digitando.

### Chat e anti-spam
- Mensagens gravadas em Postgres (id `BigInt`, paginação por cursor) e transmitidas via Redis pub/sub.
- **Mensagem é texto puro.** O front renderiza com escape total. Menções e emojis são tokenizados no cliente, sem `dangerouslySetInnerHTML`.
- Rate-limit com token bucket no Redis, por usuário **e** por IP. Detecção de flood (mensagens repetidas ou muitas em janela curta) leva a mute automático de 5 min.
- Filtro de links (bloqueados por padrão, com opção por sala) e palavras bloqueadas por sala.

### Estilos de nick sem XSS
- O usuário **nunca** fornece CSS. `Item.config` é um JSON tipado por categoria (ex.: glow = `{ colors: ["#hex"...], animation: "pulse"|"rainbow"|"gradient" }`), validado com Zod.
- Um compilador no servidor gera classes CSS a partir dessas primitivas e as publica em `/styles/items.css` com hash. As mensagens carregam só **IDs de itens** (`styleSnap`).

### Mídia com consentimento
- Upload direto ao R2 via URL pré-assinada (PUT) → registro `PENDING_SCAN` → worker:
  sha256 + pHash → confere a blocklist (`MediaHashBlock`) → hook `CsamScanner` (PhotoDNA/Thorn Safer quando aprovados) → gera versão borrada → `APPROVED` ou `QUARANTINED`.
- Foto no PV só se **os dois** tiverem `acceptPmPhotos` e idade verificada. Chega borrada e, ao clicar, o servidor gera uma versão com **marca d'água do nick de quem recebe** (rastreia vazamento) e entrega por URL assinada de ~60s.
- "Sem download" = sem link direto, `contextmenu` bloqueado, imagem em canvas. **Isso não impede print de tela.** É um dissuasor, e a marca d'água é o que de fato protege.
- Denúncia de possível menor → mídia vai para `QUARANTINED` **na hora** e a denúncia recebe prioridade 100.

### Economia (ledger de partidas dobradas)
- Carteiras: uma por usuário e duas de sistema (`SYSTEM_MINT`, `SYSTEM_SINK`).
- Toda operação cria um `LedgerTransaction` com entradas somando **zero**, com `idempotencyKey` única (`payment:<id>`, `gift:<id>`…).
- Saldo atualizado na mesma transação SQL com `SELECT … FOR UPDATE` e `CHECK (balance >= 0)`.
- Migration SQL com **triggers que bloqueiam UPDATE/DELETE** em `LedgerEntry`/`LedgerTransaction`. Correção se faz por transação de estorno.
- Nome e ícone da moeda ficam em `PlatformSetting` (padrão "Pimentas").

### Pagamentos
```ts
interface PaymentProvider {
  id: string
  createCharge(input: { paymentId; amountCents; method: 'PIX'|'CARD'; customer }): Promise<ChargeResult> // QR Pix / URL de checkout
  verifyWebhook(req: Request): Promise<VerifiedEvent>   // assinatura HMAC etc.
  parseEvent(evt): { providerPaymentId; status: PaymentStatus; eventId }
  refund?(providerPaymentId): Promise<void>
  createSubscription?(…)                                // VIP
}
```
Fluxo do webhook: grava `WebhookEvent` (único por `provider+eventId`) → responde 200 → processa: se `PAID` e `Payment.ledgerTxId` estiver vazio, credita com a key `payment:<id>`. Reentrega vira no-op. Chargeback cria estorno (que pode deixar o saldo no zero) e marca a conta.
Começo com um `FakeProvider` para desenvolvimento e testes. Os gateways reais entram na etapa 6.

### LGPD e Marco Civil
- Consentimentos versionados (`ConsentRecord`). Dados sobre vida sexual (tags, tipo de perfil) só são gravados após consentimento específico.
- Exportar dados gera um ZIP (JSON + mídias) por link assinado. Excluir conta anonimiza o usuário, apaga mídias e mantém o ledger e os `AccessLog` pelo prazo legal.
- `AccessLog` com IP **e porta** de origem, particionado por mês. Um job apaga as partições com mais de 6 meses (art. 15).
- Evidências de denúncias escaladas às autoridades ficam preservadas fora do fluxo de exclusão.

## 4. Testes (Vitest + Postgres/Redis efêmeros via Testcontainers)
- **Ledger:** soma zero, saldo nunca negativo, idempotência de webhook repetido, concorrência (N compras paralelas).
- **Permissões de sala:** matriz completa de cargo × ação × alvo.
- **Rate-limit:** bucket, flood, IP compartilhado.
- **Age gate:** cadastro de menor recusado, casal com uma pessoa menor recusado, rotas protegidas sem verificação → 403.
- E2E (Playwright) só nos fluxos críticos.

## 5. Deploy: Hostinger

Com Postgres, Redis e WebSocket de longa duração, **a hospedagem compartilhada / "Node.js Web App" da Hostinger não atende**. A opção certa é a **VPS KVM** (recomendo KVM 2: 2 vCPU / 8 GB para começar), com Docker Compose.

- A Hostinger informa que aceita conteúdo adulto **legal** ([política](https://www.hostinger.com/support/1583358-is-adult-content-allowed-at-hostinger/)). O que eles proíbem é qualquer coisa envolvendo menores, e nisso estamos alinhados.
- **Domínio temporário:** a VPS já vem com um hostname `srvXXXX.hstgr.cloud`. Dá para usar ele ou um `IP.sslip.io` com HTTPS automático do Caddy até o domínio definitivo sair.
- **Deploy via Git:** GitHub Actions → build das imagens → push para o GHCR → SSH na VPS → `docker compose pull && up -d` → `prisma migrate deploy`.
- **Acesso:** não me mande senha no chat. Quando chegarmos lá, crie uma chave SSH só para deploy e cadastre-a como *secret* do repositório (GitHub Actions) e/ou do ambiente do Claude Code.

## 6. Gateways de pagamento (levantamento preliminar)

| Gateway | Nicho adulto/social | Observação |
|---|---|---|
| Stripe | ❌ Proíbe explicitamente "adult live chat" e namoro de cunho sexual ([lista](https://stripe.com/legal/restricted-businesses)) | Descartado |
| Mercado Pago | ❌ Termos vedam conteúdo sexual | Risco alto de bloqueio de saldo |
| PagSeguro/PagBank | ❌ Veda atividades "contrárias à moral e bons costumes" | Mesmo risco |
| Pagar.me, Cielo, Getnet, Asaas, Efí | ⚠️ Em geral recusam ou exigem análise. **Confirmar por escrito** antes de usar | Não confiar em "aprovação automática" |
| **Segpay** | ✅ Especialista em adulto, **tem Pix** ([blog](https://segpay.com/blog/pix-brazils-instant-payment-revolution/)) | Forte candidato: Pix + cartão internacional |
| **CCBill / Epoch / Verotel** | ✅ Especialistas em adulto (cartão, assinaturas) | Taxas maiores (~10–15%), cobram em USD/EUR |
| PSPs "high-risk" brasileiros de Pix | ⚠️ Existem, mas a reputação varia muito | Só com contrato que cite o nicho explicitamente |

**Recomendação:** Segpay (Pix + cartão) como principal e CCBill ou Verotel como plano B de cartão. Um gateway Pix nacional só entra se aceitar o nicho **por escrito**. Na etapa 6 eu refaço essa pesquisa com os termos atuais de cada um.

## 7. Ordem das etapas
1. ✅ Plano + schema *(este documento)*
2. Scaffold do monorepo, auth, perfil, age gate
3. Salas + chat em tempo real + moderação
4. PV + mídia com consentimento
5. Loja, moeda, inventário, glow/itens
6. Pagamentos
7. Painel admin + denúncias
8. Deploy Docker (Hostinger VPS)
