# SexPapo

Comunidade liberal 18+ (casais, solteiras e solteiros): **salas de chat estilo xat**, **feed de fotos e vídeos** estilo Sexlog, **PV**, **loja de itens** para o nick e **perfil assinante** (assiste vídeos).

> O nome e a moeda são configuráveis: `NEXT_PUBLIC_SITE_NAME` e `NEXT_PUBLIC_CURRENCY_NAME`.

## O que já funciona

| Área | Recursos |
|---|---|
| Entrada | Age gate 18+, cadastro com data de nascimento de **todas** as pessoas do perfil (casal: as duas), senha argon2id, sessão httpOnly |
| Verificação | Selfie com gesto sorteado + papel com o nick, revisada no admin. Libera fotos, vídeos, PV com foto, loja e criação de salas |
| Feed | Posts com até 6 fotos **ou** 1 vídeo, reações, comentários, abas Todos / Seguindo / Minha região |
| Vídeos | Qualquer perfil verificado posta; **só assinantes assistem** (download direto bloqueado, marca d'água flutuante com o nick de quem assiste) |
| Fotos | Marca d'água com o nick do autor, EXIF/GPS removidos, sem link público (servidas com checagem de acesso) |
| Salas | `/{endereco}` criada por usuários, Dono → Moderador → Membro → Convidado, silenciar/expulsar/banir, limpar, fixar, modo lento, palavras bloqueadas, filtro de links, anti-flood, "digitando…", menções, lista de online por cargo + poder |
| PV | Quem pode me chamar (todos / quem sigo / casais / ninguém), foto só se os dois aceitarem, chega **borrada** até clicar, marca d'água com o nick de quem recebe |
| Perfil | Tipo (casal H/M, H/H, M/M, mulher, homem, trans, outro), bio, tags, álbum privado liberado por pedido, seguir, bloquear, esconder cidade, esconder de não verificados |
| Economia | Moeda virtual com **ledger de partidas dobradas** (idempotente, nunca negativo), loja com prévia ao vivo, presentes, inventário, itens 7d/30d/permanentes, edição limitada |
| Pagamento | **Pix manual**: QR Code com valor e identificador; o usuário clica "Já paguei" e o admin aprova (credita moedas ou ativa a assinatura) |
| Admin | Dashboard (online, receita, pendências), aprovação de Pix, fila de verificações, denúncias com prioridade (possível menor = topo) e procedimento SaferNet/PF, usuários (banir, cargo, moedas, VIP), salas, loja, planos, anúncios globais |
| LGPD | Consentimentos versionados, exportar dados (JSON), excluir conta, registros de acesso guardados 6 meses (Marco Civil) |

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
npm test      # 32 testes: age gate, permissões de sala, rate-limit/flood, ledger (concorrência e idempotência), Pix, itens (anti-XSS), vídeo
npm run lint  # checagem de tipos
```

Os testes do ledger usam o banco do `.env`.

## Publicar na Hostinger

Veja o passo a passo em [docs/DEPLOY-HOSTINGER.md](docs/DEPLOY-HOSTINGER.md).

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
