import { useEffect, useState } from "react";
import { AppButton } from "../../components";
import { CHAT_SOUND_CHANGED, getChatSoundEnabled, playChatSound, saveChatSoundEnabled, unlockChatSound } from "../../lib/chatSound";
import { disablePushNotifications, enablePushNotifications, getPushNotificationStatus } from "../../lib/push";

const statusText: Record<string, string> = {
  checking: "Verificando notificações deste dispositivo…",
  enabled: "Notificações ativadas neste dispositivo, inclusive para mensagens com o app fechado.",
  default: "Ative para receber mensagens e lembretes fora do app.",
  inactive: "A permissão está liberada, mas falta ativar este dispositivo.",
  granted: "A permissão está liberada, mas falta ativar este dispositivo.",
  denied: "O navegador bloqueou notificações. Libere a permissão nas configurações do site e tente novamente.",
  unsupported: "Este navegador não oferece push. No iPhone, instale o Gondly na tela inicial para usar notificações.",
  unconfigured: "O servidor ainda não está configurado para push. A ativação depende das chaves VAPID na API.",
  error: "Não foi possível ativar ou verificar as notificações. Confira sua conexão e tente novamente.",
};

export function NotificationSettings() {
  const [sound, setSound] = useState(getChatSoundEnabled);
  const [status, setStatus] = useState("checking");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  useEffect(() => {
    const update = () => setSound(getChatSoundEnabled());
    window.addEventListener(CHAT_SOUND_CHANGED, update);
    window.addEventListener("storage", update);
    let active = true;
    void getPushNotificationStatus().then(value => { if (active) setStatus(value); }).catch(() => { if (active) setStatus("error"); });
    return () => { active = false; window.removeEventListener(CHAT_SOUND_CHANGED, update); window.removeEventListener("storage", update); };
  }, []);

  async function togglePush() {
    setPending(true);
    try {
      if (status === "enabled") { await disablePushNotifications(); setStatus("inactive"); }
      else setStatus(await enablePushNotifications());
    } catch { setStatus("error"); }
    finally { setPending(false); }
  }

  return <section className="mt-4 rounded-xl border border-line bg-white p-4 shadow-soft">
    <h2 className="text-base font-black text-ink">Mensagens e notificações</h2>
    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-paper p-3">
      <div><p className="text-sm font-bold text-ink">Som das mensagens</p><p className="mt-1 text-xs text-ink/60">Preferência deste dispositivo. O volume e o modo silencioso do celular também influenciam o som.</p></div>
      <button type="button" role="switch" aria-label="Som das mensagens" aria-checked={sound} onClick={() => { saveChatSoundEnabled(!sound); if (!sound) void unlockChatSound(); }} className={`relative h-7 w-12 flex-none rounded-full ${sound ? "bg-mint" : "bg-ink/15"}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${sound ? "left-6" : "left-1"}`} />
      </button>
    </div>
    <AppButton type="button" variant="secondary" full className="mt-3" disabled={!sound} onClick={async () => {
      await unlockChatSound();
      const played = await playChatSound();
      setFeedback(played ? "Som enviado para reprodução. Se não ouviu, confira o volume e o modo silencioso do dispositivo." : "O navegador não conseguiu reproduzir o som. Toque novamente para testar e confira as permissões de áudio.");
    }}>Testar som</AppButton>
    {feedback ? <p role="status" className="mt-2 text-xs text-ink/65">{feedback}</p> : null}
    <p role="status" className="mt-4 text-sm leading-5 text-ink/65">{statusText[status]}</p>
    <AppButton type="button" variant="secondary" full className="mt-3" loading={pending} loadingLabel="Configurando" disabled={status === "checking" || status === "unsupported"} onClick={togglePush}>{status === "enabled" ? "Desativar notificações neste dispositivo" : "Ativar notificações neste dispositivo"}</AppButton>
  </section>;
}
