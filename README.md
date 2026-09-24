# SexPapo

Comunidade liberal 18+ (casais, solteiras e solteiros): **salas de chat estilo xat**, **feed de fotos e vídeos** estilo Sexlog, **PV**, **loja de itens** para o nick e **perfil assinante** (assiste vídeos).

> O nome e a moeda são configuráveis: `NEXT_PUBLIC_SITE_NAME` e `NEXT_PUBLIC_CURRENCY_NAME`.

## O que já funciona

| Área | Recursos |
|---|---|
| Entrada | Age gate 18+, cadastro com a data de nascimento de **todas** as pessoas do perfil, senha argon2id, 2FA opcional, "esqueci minha senha" por e-mail |
| Verificação | Selfie com gesto sorteado e papel com o nick, revisada no admin. Libera fotos, vídeos, PV, loja e salas |
| Perfil | Tipo (casal H/M, H/H, M/M, mulher, homem, trans, outro), "sobre ele / sobre ela" com características opcionais, gostos agrupados, álbum privado (privado / amigos / seguidores). **Nick e tipo de perfil só mudam por ticket** |
| Social | Seguir (prioridade no feed), **amizade** (libera PV, álbum e posts "só amigos"), central de Avisos com pedidos de amizade |
| Feed | Até 6 fotos **ou** 1 vídeo por post, reações, comentários com **respostas e reações** |
| Vídeos | Qualquer perfil verificado posta; **só assinantes assistem** (streaming protegido, marca d'água com o nick de quem assiste) |
| Salas (estilo xat) | Só **admin e assinantes** criam (a sala fica inativa se a assinatura vencer). Bonequinho por cargo + acessórios, glow neon, fundador exclusivo, moderação completa, reações, presentes animados, @menções com aviso, **só texto** (fotos ficam no feed e no perfil), fundo personalizado, som de entrada, histórico |
| PV | Estilo WhatsApp (lista + conversa), exige verificação, só amigos por padrão; foto só se os dois aceitarem, chega **borrada** até clicar |
| Economia | Pimentas com **ledger de partidas dobradas**, loja com prévia ao vivo (glow, neon, cores, ícones, molduras, entradas, poderes, **acessórios do boneco**), presentes, cupons |
| Pagamento | **Pix manual** com QR Code gerado da chave cadastrada no admin; o usuário clica "Já paguei" e o admin aprova. Recibo por e-mail |
| Suporte | Tickets (troca de nick, tipo de perfil, pagamento…) com conversa e aprovação no admin |
| Admin | Painel, Pix, verificações, denúncias (possível menor no topo + procedimento SaferNet/PF), tickets, usuários (banir por e-mail/IP/dispositivo, cargo, moedas, VIP, resetar senha, histórico), salas, loja, planos, cupons, anúncios, configurações (Pix e foto de fundo) |
| LGPD | Consentimentos versionados, exportar dados, excluir conta, registros de acesso por 6 meses com expurgo automático |

## Rodar local

Requisitos: Node 20+ e MySQL/MariaDB.

```bash
cp .env.example .env          # ajuste DATABASE_URL e ADMIN_EMAILS
npm install
npm run setup                 # cria as tabelas + salas oficiais, itens e planos
SEED_DEMO=1 npm run db:seed   # (opcional) usuários e posts de demonstração, senha demo12345
npm run dev                   # http://localhost:3000
```

Cadastre-se com um e-mail listado em `ADMIN_EMAILS`: essa conta vira admin já verificada.

## Testes

```bash
npm test      # 41 testes: age gate, permissões de sala, salas inativas, rate-limit/flood, ledger (concorrência e idempotência), webhook de pagamento, CSAM, Pix, itens (anti-XSS), vídeo
npm run lint  # checagem de tipos
```

Os testes do ledger usam o banco do `.env`.

## Publicar

- **Hostinger (Node.js Web App):** [docs/DEPLOY-HOSTINGER.md](docs/DEPLOY-HOSTINGER.md). É o que está no ar hoje.
- **VPS com Docker Compose (app + MySQL + HTTPS):** [docs/DEPLOY-VPS.md](docs/DEPLOY-VPS.md).

## Pagamentos plugáveis

`src/server/payments/`: a interface `PaymentProvider` (`createCharge` + `parseWebhook`) tem o Pix manual ativo e um **modelo de gateway** (`exampleGateway.ts`, com webhook assinado por HMAC). O webhook `POST /api/webhooks/{provider}` grava cada evento antes de processar e é **idempotente**: reentregas não creditam duas vezes, e isso tem teste. Para ligar um gateway, copie o modelo, ajuste para a API escolhida e defina `PAYMENT_PROVIDER`.

## Proteção contra CSAM

Toda imagem passa pela blocklist de hashes e, se configurado (`CSAM_SCAN_URL`), por um serviço externo de detecção (PhotoDNA, Thorn Safer…). Se o resultado for positivo, o upload é recusado e a mídia fica em quarentena com a evidência preservada. O hash é bloqueado e uma denúncia de prioridade máxima é aberta no admin.

## Estrutura

```
prisma/schema.prisma   modelo do banco (MySQL)
prisma/seed.ts         salas oficiais, itens, pacotes, planos (+ demo)
src/app/(public)       age gate, landing, cadastro, login, termos, privacidade
src/app/(app)          feed, salas, [slug] (sala), PV, perfil, loja, carteira, assinar, admin
src/app/api            polling do chat/PV, mídia protegida, exportação LGPD
src/server             auth, ledger, mídia/marca d'água, acesso, salas, PV
src/lib                regras puras e testadas: idade, permissões, rate-limit, itens, Pix
tests/                 Vitest
docs/                  arquitetura, deploy, prints
```
