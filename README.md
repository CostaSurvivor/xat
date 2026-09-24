# SexPapo

Comunidade liberal 18+ (casais, solteiras e solteiros), com **visual claro (fundo branco) no estilo do Sexlog**: **salas de chat estilo xat**, **feed de fotos e vídeos** estilo Sexlog, **PV**, **loja de itens** para o nick e **perfil assinante** (assiste vídeos).

> O nome e a moeda são configuráveis: `NEXT_PUBLIC_SITE_NAME` e `NEXT_PUBLIC_CURRENCY_NAME`.

## O que já funciona

| Área | Recursos |
|---|---|
| Entrada | Age gate 18+, cadastro com a data de nascimento de **todas** as pessoas do perfil, **login com Google ou e-mail e senha** (a pessoa escolhe), senha argon2id, 2FA opcional (vale também no Google), "esqueci minha senha" por e-mail |
| Verificação | Selfie com gesto sorteado e papel com o nick, revisada no admin. Libera fotos, vídeos, PV, loja e salas |
| Perfil | Tipo (casal H/M, H/H, M/M, mulher, homem, trans, outro), "sobre ele / sobre ela" com características opcionais, gostos agrupados, álbum privado (privado / amigos / seguidores). **Nick e tipo de perfil só mudam por ticket**; **álbuns por tema** (até 10, com 30 fotos cada), cada um com quem pode ver: perfis verificados, seguidores, amigos ou só quem o dono liberar; quem não pode ver recebe a versão borrada |
| Destaques | **Fotos em alta** (semana/mês, por estado) e **perfis mais curtidos** (casais, mulheres, homens, trans e outros); contam só reações de perfis verificados e cada comentarista 1x, sem o próprio autor, só posts públicos e só autores verificados; selo **🏆 Top 10 da semana** no perfil; faixa "Em alta" no feed; página própria de cada post |
| Grupos | **Grupos por interesse** (Iniciantes, Casais procuram casais, Ménage, Swing em viagem, Fetiches, Casas e clubes) criados só pela equipe em `/admin/grupos`; membros entram, postam e comentam dentro do grupo; grupos **só de casais** checam o tipo de perfil; posts de grupo não vão para o feed nem para os Destaques; grupos arquivados somem para os usuários |
| Depoimentos | Referências entre perfis: só **perfis verificados** escrevem (1 por perfil, até 5 por dia, sem telefone ou links), com a marca **"🤝 nos conhecemos pessoalmente"**; o dono **aprova antes de publicar**, pode tirar do perfil ou excluir; editar devolve para aprovação; quem teve o depoimento ocultado não é avisado; contagem de "conheceram pessoalmente" no perfil; selo **🤝 Confirmado** no perfil e na busca com 3 ou mais depoimentos presenciais aprovados de perfis verificados; denunciável |
| Stories | Fotos que **somem em 24 h**, para todos ou **só amigos**; bandeja no topo do feed (eu, amigos, quem sigo e perfis do meu estado) com anel colorido para o que ainda não vi; anel no avatar do perfil; visualizador em tela cheia com barras de progresso, toque/setas e "Responder no PV"; o autor vê **quem viu** (equipe e poder Invisível não deixam rastro); só perfis verificados postam, até 10 no ar; foto com marca d'água, apagada da hospedagem 7 dias depois de vencer (menos se houver denúncia aberta) |
| Proximidade | **Perto de você** em Pessoas: raio de 10 a 300 km ou Brasil todo, somado a tipo de perfil, o que curte, online, verificados e com foto; distância pela cidade (base do IBGE com os 5.570 municípios; sugestões no campo cidade) ou por **localização aproximada** do aparelho (opcional, arredondada a ~1 km); distância só em faixas ("~15 km"); quem esconde a cidade ou desliga a opção fica fora da busca por raio |
| Social | **Quem visitou meu perfil** (contagem para todos; ver quem visitou é benefício de assinante; equipe do site e poder Invisível não deixam rastro; 90 dias), seguir (prioridade no feed), **amizade** (libera PV, álbum e posts "só amigos"), central de Avisos com pedidos de amizade |
| Feed | Até 6 fotos **ou** 1 vídeo por post, reações, comentários com **respostas e reações** |
| Vídeos | Qualquer perfil verificado posta; **só assinantes assistem** (streaming protegido, marca d'água com o nick de quem assiste) |
| Salas (estilo xat) | Salas fixas da plataforma: **Geral** (Brasil todo), **Só Casais** (só entra perfil de casal) e **uma por estado**; ninguém cria salas. Geral e Só Casais são moderadas só pela equipe do site; nas salas de estado, admin/moderadores do site nomeiam moderadores em **Admin → Salas**. Visual estilo xat: bonequinho por cargo (cores do xat) + acessórios, frase de status, lista Online/Offline, mini-perfil com ações, **PC em abas dentro da sala**, glow neon, fundador exclusivo, moderação completa, reações, presentes animados, @menções com aviso, **só texto** (fotos ficam no feed e no perfil), fundo personalizado, som de entrada, histórico; salas de estado **agrupadas por região** (Sul, Sudeste, Centro-Oeste, Nordeste, Norte), com a região de quem vê primeiro e o Sul em destaque ("Bah, tchê!") |
| Ao vivo | **Só assinantes transmitem**. Transmissão da câmera direto do navegador (WebRTC, sem servidor de mídia), chat ao vivo, **gorjetas em Pimentas** com animação, meta com barra de progresso, ranking de quem mais apoiou, só assinantes (opcional), remover espectador, encerramento pela moderação, marca d'água com o nick de quem assiste, aviso para seguidores e amigos |
| Eventos | Festas e encontros liberais: assinantes verificados (e a equipe) divulgam com capa, data (horário de Brasília), local, valor e "só casais"; **só aparecem após aprovação** em Admin → Eventos; lista com o seu estado primeiro, "Vou"/"Talvez", quem confirmou, avisos, denúncia e cancelamento |
| PV | Estilo WhatsApp (lista + conversa), exige verificação, só amigos por padrão; foto só se os dois aceitarem, chega **borrada** até clicar |
| Economia | Pimentas com **ledger de partidas dobradas**, loja com abas, busca, raridade, destaques e prévia ao vivo (glow, neon, cores, ícones, molduras, entradas, poderes como invisível, nick maior, destaque, PV prioritário e **fixar mensagem**, **acessórios do boneco**), presentes, cupons; **Coleção Tchê** para os gaúchos: chapéu gaúcho e cuia de chimarrão no boneco, ícone 🧉, nick e moldura Farroupilha, texto Verde Pampa (a busca da loja também procura na descrição) |
| Trocas (estilo xat) | Troca segura de Pimentas, **itens permanentes** e dias de assinatura: oferta dos dois lados, mudança zera aceites + trava de 5 s, aceite duplo e **confirmação com senha**, execução atômica |
| Pagamento | **Pix manual** com QR Code gerado da chave cadastrada no admin; o usuário clica "Já paguei" e o admin aprova. Recibo por e-mail |
| Suporte | Tickets (troca de nick, tipo de perfil, pagamento…) com conversa e aprovação no admin |
| Admin | Painel, Pix, verificações, denúncias (possível menor no topo + procedimento SaferNet/PF), tickets, usuários (banir por e-mail/IP/dispositivo, cargo, moedas, VIP, resetar senha, histórico), salas, loja, planos, cupons, anúncios, configurações (Pix e foto de fundo); **⚡ Fila rápida** (`/admin/fila`): verificações, eventos e denúncias numa fila só, por prioridade (possível menor primeiro), com atalhos de teclado (A/R, I/D/S/B, J/K; escalar crime só pelo botão); **tirar o verificado** de um perfil com motivo (a pessoa é avisada e pode enviar nova selfie) |
| App no celular | **PWA instalável**: botão "📲 Instalar app" (Android/PC) e instruções para iPhone; abre em tela cheia com ícone próprio. Por privacidade, nada de fotos, mensagens ou páginas fica salvo no aparelho; só a tela "sem conexão" |
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

Cadastre-se com um e-mail listado em `ADMIN_EMAILS`: essa conta vira admin já verificada (só enquanto não existir nenhum admin; depois, promova pelo painel).

## Testes

```bash
npm test      # 100 testes (+2 de S3 com S3_TEST_ENDPOINT): login com Google, age gate, ao vivo (gorjetas, sinalização), permissões de sala, salas inativas, rate-limit/flood, ledger (concorrência e idempotência), trocas, webhook de pagamento, CSAM, Pix, itens (anti-XSS), vídeo
npm run lint  # checagem de tipos
```

A cada PR e push na `main`, o GitHub Actions (`.github/workflows/ci.yml`) sobe um MySQL, roda tipagem, testes e build.

Os testes do ledger usam o banco do `.env`.

## Publicar

- **Hostinger (Node.js Web App):** [docs/DEPLOY-HOSTINGER.md](docs/DEPLOY-HOSTINGER.md). É o que está no ar hoje.
- **VPS com Docker Compose (app + MySQL + HTTPS):** [docs/DEPLOY-VPS.md](docs/DEPLOY-VPS.md).

## Pagamentos plugáveis

`src/server/payments/`: a interface `PaymentProvider` (`createCharge` + `parseWebhook`) tem o Pix manual ativo e um **modelo de gateway** (`exampleGateway.ts`, com webhook assinado por HMAC). O webhook `POST /api/webhooks/{provider}` grava cada evento antes de processar e é **idempotente**: reentregas não creditam duas vezes, e isso tem teste. Para ligar um gateway, copie o modelo, ajuste para a API escolhida e defina `PAYMENT_PROVIDER`.

## Fotos e vídeos em S3 / Cloudflare R2 (opcional)

Por padrão as mídias ficam no disco (`UPLOAD_DIR`). Para usar um bucket S3 compatível (R2, AWS, B2, Wasabi):

1. Crie um bucket **privado** e uma chave de acesso.
2. Preencha `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID` e `S3_SECRET_ACCESS_KEY` (veja `.env.example`).
3. Rode `npm run storage:to-s3` para copiar o que já existe. Pode repetir: só envia o que falta.
4. Defina `STORAGE_DRIVER=s3` e faça o redeploy.

As fotos continuam passando por `/api/media`, então marca d'água, borrado e regras de acesso seguem valendo.

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
