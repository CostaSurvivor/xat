# Publicar na Hostinger (sem VPS)

O app foi feito para rodar como **Node.js Web App** da Hostinger:

- **Banco:** MySQL da própria Hostinger.
- **Chat em tempo real:** por polling HTTP, então não precisa de WebSocket nem de Redis.
- **Fotos e vídeos:** ficam no disco da hospedagem.

## 1. Plano

Node.js Web Apps existem nos planos **Business Web Hosting** e **Cloud** (Startup / Professional / Enterprise). O plano Premium não serve.

## 2. Banco de dados

hPanel → **Bancos de dados → MySQL** → crie banco, usuário e senha. Anote tudo para montar a URL:

```
mysql://USUARIO:SENHA@localhost:3306/NOME_DO_BANCO
```

(Se o hPanel mostrar outro host, use o host mostrado lá no lugar de `localhost`.)

## 3. Criar o app a partir do GitHub

hPanel → **Sites → Adicionar site → Node.js Apps → Importar repositório Git**. Autorize o GitHub e escolha:

- **Repositório:** `CostaSurvivor/xat`
- **Branch:** `main`, depois de fazer o merge. Para testar antes, use `claude/adult-chat-platform-xat-k68lja`.
- **Framework:** Next.js
- **Node:** 22.x
- **Comando de build:** `npm run build:hostinger`. Ele cria ou atualiza as tabelas, roda o seed (seguro repetir) e compila.
- **Comando de start:** `npm start`

Durante o teste, o **domínio temporário** que a Hostinger oferece já serve.

## 4. Variáveis de ambiente

Na tela do app → **Variáveis de ambiente**, copie de `.env.example` e preencha:

| Variável | Exemplo |
|---|---|
| `DATABASE_URL` | `mysql://u123_sex:SENHA@localhost:3306/u123_sexpapo` |
| `NEXT_PUBLIC_SITE_NAME` | `SexPapo` |
| `NEXT_PUBLIC_CURRENCY_NAME` | `Pimentas` |
| `ADMIN_EMAILS` | seu e-mail (vira admin ao se cadastrar) |
| `UPLOAD_DIR` | **pasta fora do app**, ex.: `/home/u123456789/midias-sexpapo` |
| `PIX_KEY` (opcional) | melhor cadastrar em **Admin → Configurações** |
| `MAX_VIDEO_MB` | `100` |
| `DPO_EMAIL` | e-mail de contato LGPD |
| `FOUNDER_EMAILS` | e-mail do fundador (visual exclusivo no chat) |
| `PUBLIC_URL` | endereço do site (links dos e-mails) |
| `LIVE_MAX_VIEWERS` / `LIVE_TIP_FEE_PCT` | ao vivo: espectadores com vídeo por live (padrão 10) e taxa da plataforma sobre gorjetas (padrão 0) |
| `LIVE_TURN_URLS` / `LIVE_TURN_USERNAME` / `LIVE_TURN_CREDENTIAL` | servidor TURN (opcional, melhora o ao vivo em 4G/5G) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `MAIL_FROM` | e-mail para "esqueci minha senha" e recibos (Hostinger: `smtp.hostinger.com`, 465) |

> ⚠️ **`UPLOAD_DIR` fora da pasta do app é importante.** Se ficar dentro, um novo deploy pode apagar as fotos. Para descobrir o caminho da sua home, use o Gerenciador de Arquivos ou rode `pwd` via SSH.

> `NEXT_PUBLIC_*` é lido durante o build. Se trocar o nome, faça um redeploy.

## 5. Primeiro acesso

1. Abra o domínio temporário, aceite o aviso 18+ e **cadastre-se com o e-mail de `ADMIN_EMAILS`**.
2. O botão **ADMIN** aparece no topo. Em **Admin → Configurações**, cadastre sua chave Pix (tem um QR de teste). Em **Admin → Loja**, ajuste pacotes de moeda e planos de assinatura.
3. Faça um Pix de teste de R$ 0,01 para você mesmo (ou só gere o QR) e confira se nome e chave aparecem certos no app do banco.

## 6. Login com Google (opcional)

As pessoas escolhem entre **Continuar com Google** e **e-mail e senha**. O botão só aparece depois de configurar:

1. Acesse [console.cloud.google.com](https://console.cloud.google.com) → crie um projeto.
2. **APIs e serviços → Tela de consentimento OAuth**:
   - Tipo **Externo**, com o nome do site, e-mail de suporte, domínio e links de Termos e Privacidade.
   - Escopos: apenas `openid`, `email` e `profile`.
   - Publique o app. Enquanto estiver em "Teste", só os e-mails cadastrados como testadores conseguem entrar.
3. **Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web**. Em **URIs de redirecionamento autorizados**, coloque exatamente `https://SEU-DOMINIO/api/auth/google/callback` (o mesmo domínio de `PUBLIC_URL`).
4. Copie o ID e a chave secreta para `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` nas variáveis de ambiente e faça o redeploy.

Como funciona:

- **Cadastro:** quem entra pelo Google pela primeira vez ainda informa o tipo de perfil, as **datas de nascimento de todos** (18+) e aceita termos e consentimentos. Depois vai para a verificação por selfie, como todo mundo.
- **Senha:** a conta nasce sem senha. Dá para definir uma em Conta, e ela é necessária para confirmar trocas e para excluir a conta.
- **Conta existente:** o Google **não** é vinculado sozinho a uma conta que já existe com o mesmo e-mail, para evitar tomada de conta. A pessoa entra com a senha e clica em **Vincular Google** em Conta.
- **2FA:** contas com 2FA recebem o pedido do código também no login pelo Google.
- **Admin:** cadastro pelo Google nunca vira admin sozinho.

> ⚠️ **Conteúdo adulto:** as regras do Google podem restringir o login em sites adultos. Se o Google suspender o app, o login com e-mail e senha continua funcionando, e quem só tinha Google pode usar "Esqueci minha senha" (precisa do SMTP configurado).

## 7. Rotina do dia a dia

- **Admin → Pix:** confira no extrato do banco o valor e o identificador (ex.: `PABC1234`), depois clique em **Aprovar**. O sistema credita as moedas ou ativa a assinatura **uma única vez**, mesmo que você clique duas vezes.
- **Admin → Verificações:** aprove as selfies. Na dúvida sobre a idade, **recuse**.
- **Admin → Denúncias:** "possível menor" aparece sempre no topo. Siga o procedimento descrito na própria tela (SaferNet / PF).

## Limites conhecidos da hospedagem compartilhada

- **Tamanho de upload:** a Hostinger pode limitar o tamanho das requisições. Se vídeos grandes falharem, reduza `MAX_VIDEO_MB` (ex.: 50) ou fale com o suporte.
- **Vídeos sem conversão:** sem `ffmpeg` no servidor, o vídeo fica como foi enviado (MP4/MOV/WEBM). A marca d'água do vídeo é sobreposta no player com o nick de quem assiste. A capa do vídeo recebe marca d'água de verdade.
- **Escala:** o chat por polling aguenta bem algumas centenas de pessoas online. Para milhares ao mesmo tempo, a migração natural é uma VPS com WebSocket e Redis. O código foi separado para essa troca ser localizada (`src/app/api/rooms/*` e `ChatRoom.tsx`).
- **Porta de origem (Marco Civil):** na hospedagem compartilhada, o proxy da Hostinger pode não repassar a porta do visitante. O app grava IP, data e hora sempre, e a porta quando o proxy envia `X-Client-Port` ou `X-Real-Port`. Na VPS, o Caddy já envia.
- **Ao vivo:** o vídeo vai direto do aparelho de quem transmite para cada espectador (WebRTC), então a hospedagem não carrega o vídeo. O limite é o upload de quem transmite: 10 espectadores com vídeo por padrão. Em 4G/5G algumas conexões falham sem **TURN**. Para lives com centenas de pessoas, o caminho é um SFU (LiveKit) numa VPS.
- **Fotos em S3/R2 (opcional):** para não depender do disco da hospedagem, veja a seção "Fotos e vídeos em S3 / Cloudflare R2" no README.
- **Backup:** ative os backups do plano e baixe periodicamente a pasta `UPLOAD_DIR` e o banco.
