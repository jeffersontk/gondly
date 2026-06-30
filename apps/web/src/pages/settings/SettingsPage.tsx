import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { AppButton, MemberAvatar, ScreenContainer } from "../../components";
import { useAds } from "../../lib/ads";
import { useAuth } from "../../lib/auth";
import { MonetizationBadge } from "../../components";
import type { User } from "../../types";

export function SettingsPage() {
  const { user, logout } = useAuth();
  const { hasNoAds } = useAds();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <ScreenContainer title="Ajustes" backTo="/app/home">
      <div className="rounded-xl bg-white p-4 shadow-soft">
        <div className="flex items-center gap-3">
          <MemberAvatar user={(user as User) ?? { name: "U" }} />
          <div>
            <p className="text-sm font-black text-ink">{user?.name}</p>
            <p className="text-xs text-ink/55">{user?.email}</p>
          </div>
        </div>

        {!hasNoAds ? (
          <AppButton className="mt-4" full variant="secondary" onClick={() => navigate("/app/billing")}>
            Remover anuncios
          </AppButton>
        ) : null}

        <div className="mt-4 grid gap-2">
          <AppButton variant="danger" icon={<LogOut className="h-4 w-4" />} onClick={handleLogout} loading={loggingOut} loadingLabel="Saindo">
            Sair
          </AppButton>
        </div>
      </div>
    </ScreenContainer>
  );
}
