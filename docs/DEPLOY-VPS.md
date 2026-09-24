# Migrar para VPS (Docker)

Quando o volume crescer (milhares de pessoas online ao mesmo tempo, vídeos grandes), dá para sair da hospedagem compartilhada e ir para uma VPS (ex.: Hostinger KVM 2), com Docker Compose.

O compose sobe três serviços:

- **app**: Next.js.
- **db**: MySQL 8.4.
- **caddy**: HTTPS automático com Let's Encrypt; repassa a **porta de origem** do visitante, que o Marco Civil exige guardar.

## Passo a passo

```bash
# na VPS (Ubuntu), com Docker instalado
git clone https://github.com/CostaSurvivor/xat.git && cd xat
cp .env.example .env        # preencha ADMIN_EMAILS, FOUNDER_EMAILS, SMTP, PUBLIC_URL...
cat >> .env <<'X'
DOMAIN=sexpapo.com
MYSQL_PASSWORD=troque-esta-senha
MYSQL_ROOT_PASSWORD=troque-esta-tambem
X
docker compose up -d --build
```

Aponte o DNS do domínio (registro A) para o IP da VPS. O Caddy emite o certificado sozinho.

## Migrar os dados da Hostinger

1. **Banco:** no hPanel → phpMyAdmin, exporte o banco `u528243860_sexpapo`. Na VPS, importe com `docker compose exec -T db mysql -usexpapo -p sexpapo < dump.sql`.
2. **Fotos e vídeos:** baixe a pasta `storage` do site (Gerenciador de Arquivos ou SSH) e copie para o volume: `docker compose cp ./storage/. app:/data/uploads/`.
3. Troque o DNS para a VPS.

## Atualizar

```bash
git pull && docker compose up -d --build
```

O schema é aplicado e o seed (idempotente) roda a cada subida.

## Próximos passos de escala (opcional)

- Trocar o polling do chat por WebSocket + Redis. A troca fica restrita a `src/app/api/rooms/*` e `ChatRoom.tsx`.
- Guardar mídias no Cloudflare R2/S3: implementar `src/server/storage.ts` com a mesma interface.
- Transcodificar vídeos com ffmpeg (marca d'água "queimada" no vídeo).
