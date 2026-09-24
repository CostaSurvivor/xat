import QRCode from "qrcode";
import { requireAdmin } from "@/server/auth";
import { getPixConfig } from "@/server/settings";
import { pixPayload } from "@/lib/pix";
import { saveHeroImage, savePixConfig } from "@/app/actions/admin";
import { getHeroImage } from "@/server/settings";
import { ActionForm } from "@/components/Forms";

export const dynamic = "force-dynamic";

export default async function Config() {
  await requireAdmin();
  const pix = await getPixConfig();
  const hero = await getHeroImage();
  const test = pix.key ? pixPayload({ key: pix.key, name: pix.merchantName, city: pix.merchantCity, amountCents: 1, txid: "TESTE" }) : null;
  const qr = test ? await QRCode.toDataURL(test, { margin: 1, width: 200 }) : null;
  return (
    <div className="space-y-4">
    <section className="card grid gap-4 p-5 md:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        <h2 className="text-xl font-bold">Foto de fundo da tela inicial</h2>
        <p className="text-sm text-mute">
          Aparece bem opaca atrás do texto da página de entrada. Use uma foto sensual <b className="text-white">sem nudez explícita</b>, de
          pessoas adultas, que você tenha direito de usar (sua própria sessão de fotos ou banco de imagens com licença comercial).
        </p>
        <ActionForm action={saveHeroImage} className="space-y-2" okText="Fundo atualizado!">
          <input type="file" name="hero" accept="image/jpeg,image/png,image/webp" className="input" />
          <button className="btn-gold">Enviar foto</button>
        </ActionForm>
        {hero && (
          <ActionForm action={saveHeroImage} okText="Voltou ao fundo padrão.">
            <input type="hidden" name="remove" value="1" />
            <button className="text-xs text-mute underline">Voltar ao fundo padrão</button>
          </ActionForm>
        )}
      </div>
      <div className="relative aspect-video overflow-hidden rounded-xl bg-ink">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={hero ? `/api/public/hero?v=${hero.v}` : "/hero.svg"} alt="" className={`h-full w-full object-cover ${hero ? "opacity-35" : "opacity-90"}`} />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/70 to-transparent" />
        <span className="absolute left-3 top-3 text-xs text-mute">prévia</span>
      </div>
    </section>
    <div className="grid gap-4 md:grid-cols-[1fr_260px]">
      <section className="card space-y-3 p-5">
        <h1 className="text-xl font-bold">Pix para recargas e assinaturas</h1>
        <p className="text-sm text-mute">
          Informe a chave Pix que vai receber os pagamentos (CPF, CNPJ, e-mail, celular com +55 ou chave aleatória). O QR Code de cada compra é gerado
          automaticamente com o valor e o identificador do pedido.
        </p>
        <ActionForm action={savePixConfig} className="space-y-3" okText="Pix salvo! Os próximos QR Codes já usam esta chave.">
          <div>
            <label className="label">Chave Pix</label>
            <input name="key" defaultValue={pix.key} required className="input" placeholder="ex.: +5511999999999 ou seu@email.com" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Nome do recebedor (até 25)</label>
              <input name="merchantName" defaultValue={pix.merchantName} maxLength={25} required className="input" />
            </div>
            <div>
              <label className="label">Cidade (até 15)</label>
              <input name="merchantCity" defaultValue={pix.merchantCity} maxLength={15} required className="input" />
            </div>
          </div>
          <button className="btn-gold">Salvar</button>
        </ActionForm>
      </section>
      <aside className="card p-5 text-center text-sm">
        <p className="label">Teste (R$ 0,01)</p>
        {qr ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR de teste" className="mx-auto rounded-lg bg-white p-1" width={200} height={200} />
            <p className="mt-2 text-xs text-mute">Escaneie no app do banco e confira se o nome e a chave aparecem certos. Não precisa concluir o pagamento.</p>
          </>
        ) : (
          <p className="text-mute">Nenhuma chave cadastrada ainda.</p>
        )}
      </aside>
    </div>
    </div>
  );
}
