import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Archive,
  BarChart3,
  Check,
  Edit,
  History,
  LogOut,
  Package,
  Plus,
  RefreshCcw,
  Share2,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import type { SharedRole, Unit } from "@gondly/types";
import { api } from "../lib/api";
import { createRealtimeSocket } from "../lib/realtime";
import { useAuth } from "../lib/auth";
import {
  AppButton,
  AppInput,
  ConfirmDialog,
  DateRangeFilter,
  EmptyState,
  ErrorState,
  FloatingActionButton,
  ListItemRow,
  LoadingState,
  MarketCard,
  MarketListCard,
  MarketSelect,
  MemberAvatar,
  MoneyInput,
  OnlineParticipantsBar,
  MonetizationBadge,
  PriceCard,
  ProductCard,
  ProductSearchInput,
  PurchaseItemCard,
  QuantityInput,
  ScreenContainer,
  SearchBar,
  SectionHeader,
  StartPurchasePanel,
  SummaryCard,
  UnitSelect,
} from "../components";
import { AdSlot, useAds } from "../lib/ads";
import type { DashboardReport, Market, MarketList, MarketListItem, PriceComparison, Product, Purchase, PurchaseItem, User } from "../types";

const units = ["un", "kg", "g", "l", "ml", "pacote", "caixa", "outro"] as const;
const roles = ["editor", "viewer"] as const;

const listSchema = z.object({
  name: z.string().min(2, "Informe um nome"),
  description: z.string().optional(),
});

const marketSchema = z.object({
  name: z.string().min(2, "Informe um nome"),
  address: z.string().optional(),
  city: z.string().optional(),
  notes: z.string().optional(),
});

const productSchema = z.object({
  name: z.string().min(2, "Informe um produto"),
  brand: z.string().optional(),
  category: z.string().optional(),
  defaultUnit: z.enum(units),
  barcode: z.string().optional(),
});

const cartItemSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().min(2, "Informe um produto"),
  brand: z.string().optional(),
  category: z.string().optional(),
  quantity: z.coerce.number().positive("Quantidade deve ser maior que zero"),
  unit: z.enum(units),
  pricePaid: z.coerce.number().min(0, "Preco deve ser maior ou igual a zero"),
  notes: z.string().optional(),
});

const finishSchema = z.object({
  marketId: z.string().min(1, "Selecione o mercado"),
  finalPaidAmount: z.coerce.number().min(0, "Valor invalido"),
  notes: z.string().optional(),
});

const inviteSchema = z.object({
  inviteEmail: z.string().email("E-mail invalido").optional().or(z.literal("")),
  role: z.enum(roles),
});

type ListForm = z.infer<typeof listSchema>;
type MarketForm = z.infer<typeof marketSchema>;
type ProductForm = z.infer<typeof productSchema>;
type CartItemForm = z.infer<typeof cartItemSchema>;
type FinishForm = z.infer<typeof finishSchema>;
type InviteForm = z.infer<typeof inviteSchema>;

export function LoginPage() {
  const { devLogin, loginWithGoogleToken } = useAuth();
  const navigate = useNavigate();
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const form = useForm<{ email: string; name: string }>({
    defaultValues: { email: "demo@gondly.local", name: "Demo Gondly" },
  });

  useEffect(() => {
    if (!clientId || !buttonRef.current) return;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: { credential: string }) => {
          await loginWithGoogleToken(response.credential);
          navigate("/app/home");
        },
      });
      window.google?.accounts.id.renderButton(buttonRef.current, { theme: "outline", size: "large", width: 320 });
    };
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, [clientId, loginWithGoogleToken, navigate]);

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-sm place-items-center px-5">
      <div className="w-full">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src="/icons/icon.svg" alt="Gondly" className="h-20 w-20 rounded-[22px] shadow-soft" />
          <h1 className="mt-5 text-4xl font-black text-ink">Gondly</h1>
          <p className="mt-2 text-sm text-ink/60">Listas, carrinho e preços em um fluxo mobile.</p>
        </div>

        {clientId ? <div ref={buttonRef} className="flex justify-center" /> : null}

        <form
          className="mt-4 space-y-3 rounded-[8px] bg-white p-4 shadow-soft"
          onSubmit={form.handleSubmit(async (values) => {
            await devLogin(values.email, values.name);
            navigate("/app/home");
          })}
        >
          <AppInput label="E-mail" type="email" {...form.register("email")} />
          <AppInput label="Nome" {...form.register("name")} />
          <AppButton full type="submit">
            Entrar em desenvolvimento
          </AppButton>
        </form>
      </div>
    </main>
  );
}

export function HomePage() {
  const { user } = useAuth();
  const { hasNoAds } = useAds();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: () => api<DashboardReport>("/reports/dashboard") });
  const active = useQuery({ queryKey: ["active-purchases"], queryFn: () => api<Purchase[]>("/purchases/active") });
  const startPurchase = useMutation({
    mutationFn: () => api<Purchase>("/purchases/start", { method: "POST", body: {} }),
    onSuccess: async (purchase) => {
      await queryClient.invalidateQueries({ queryKey: ["active-purchases"] });
      navigate(`/app/purchase/${purchase.id}`);
    },
  });

  if (dashboard.isLoading) return <LoadingState />;
  if (dashboard.isError) return <ScreenContainer title="Gondly"><ErrorState /></ScreenContainer>;

  const data = dashboard.data;

  return (
    <ScreenContainer title="Gondly" subtitle={user?.name}>
      <div className="mb-4 flex items-center justify-between rounded-[8px] bg-white p-3 shadow-soft">
        <span className="text-sm font-semibold text-ink/65">Monetizacao</span>
        <MonetizationBadge hasNoAds={hasNoAds} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label="Gasto no mes" value={formatBRL(data?.totalSpentMonth ?? 0)} />
        <SummaryCard label="Compras" value={data?.monthPurchasesCount ?? 0} tone="sky" />
        <SummaryCard label="Mercado" value={data?.favoriteMarket ?? "-"} tone="leaf" />
        <SummaryCard label="Economia" value={formatBRL(data?.estimatedSavings ?? 0)} tone="tomato" />
      </div>

      <SectionHeader title="Atalhos" />
      <div className="grid grid-cols-2 gap-3">
        <Shortcut to="/app/lists/new" icon={<Plus className="h-5 w-5" />} label="Nova lista" />
        <Shortcut to="/app/history" icon={<History className="h-5 w-5" />} label="Historico" />
        <Shortcut to="/app/compare" icon={<BarChart3 className="h-5 w-5" />} label="Precos" />
        <Shortcut to="/app/markets" icon={<Package className="h-5 w-5" />} label="Mercados" />
      </div>

      <SectionHeader title="Compra" />
      {active.data?.length ? (
        <AppButton full icon={<ShoppingCart className="h-5 w-5" />} onClick={() => navigate(`/app/purchase/${active.data[0].id}`)}>
          Continuar compra
        </AppButton>
      ) : (
        <StartPurchasePanel onStart={() => startPurchase.mutate()} />
      )}

      <SectionHeader title="Ultima compra" />
      {data?.lastPurchase ? (
        <button onClick={() => navigate(`/app/history/${data.lastPurchase?.id}`)} className="w-full rounded-[8px] bg-white p-4 text-left shadow-soft">
          <p className="text-sm font-black text-ink">{data.lastPurchase.market?.name ?? "Mercado"}</p>
          <p className="mt-1 text-xs text-ink/55">{formatBRL(data.lastPurchase.finalPaidAmount ?? data.lastPurchase.subtotalCalculated)}</p>
        </button>
      ) : (
        <EmptyState title="Nenhuma compra registrada ainda." />
      )}

      <div className="mt-4">
        <AdSlot />
      </div>
    </ScreenContainer>
  );
}

export function ListsPage() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const { data = [], isLoading } = useQuery({ queryKey: ["lists"], queryFn: () => api<MarketList[]>("/lists") });
  const filtered = data.filter((list) => list.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <ScreenContainer title="Listas">
      <SearchBar placeholder="Buscar lista" value={q} onChange={(event) => setQ(event.target.value)} />
      <div className="mt-4 space-y-3">
        {isLoading ? <LoadingState /> : null}
        {!isLoading && !filtered.length ? <EmptyState title="Você ainda não tem listas. Crie sua primeira lista de mercado." /> : null}
        {filtered.map((list, index) => (
          <div key={list.id} className="space-y-3">
            <MarketListCard list={list} onClick={() => navigate(`/app/lists/${list.id}`)} />
            {index === 2 ? <AdSlot /> : null}
          </div>
        ))}
      </div>
      <FloatingActionButton label="Lista" onClick={() => navigate("/app/lists/new")} />
    </ScreenContainer>
  );
}

export function ListDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [onlineParticipants, setOnlineParticipants] = useState<Array<{ userId?: string; name?: string }>>([]);
  const list = useQuery({ queryKey: ["list", id], queryFn: () => api<MarketList>(`/lists/${id}`), enabled: Boolean(id) });
  const inviteForm = useForm<InviteForm>({ resolver: zodResolver(inviteSchema), defaultValues: { role: "editor" } });
  const toggleItem = useMutation({
    mutationFn: (itemId: string) => api(`/lists/${id}/items/${itemId}/check`, { method: "PATCH", body: {} }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["list", id] }),
  });
  const removeItem = useMutation({
    mutationFn: (itemId: string) => api(`/lists/${id}/items/${itemId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["list", id] }),
  });
  const archive = useMutation({
    mutationFn: () => api(`/lists/${id}/archive`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["list", id] }),
  });
  const duplicate = useMutation({
    mutationFn: () => api<MarketList>(`/lists/${id}/duplicate`, { method: "POST" }),
    onSuccess: async (copy) => {
      await queryClient.invalidateQueries({ queryKey: ["lists"] });
      navigate(`/app/lists/${copy.id}`);
    },
  });
  const remove = useMutation({
    mutationFn: () => api(`/lists/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["lists"] });
      navigate("/app/lists");
    },
  });
  const assignItem = useMutation({
    mutationFn: (itemId: string) => api(`/lists/${id}/items/${itemId}/assign`, { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["list", id] }),
  });
  const purchaseListItem = useMutation({
    mutationFn: (itemId: string) => api(`/lists/${id}/items/${itemId}/purchase`, { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["list", id] }),
  });
  const skipItem = useMutation({
    mutationFn: (itemId: string) => api(`/lists/${id}/items/${itemId}/skip`, { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["list", id] }),
  });
  const start = useMutation({
    mutationFn: () => api<Purchase>("/purchases/start", { method: "POST", body: { sourceListId: id } }),
    onSuccess: (purchase) => navigate(`/app/purchase/${purchase.id}`),
  });
  const invite = useMutation({
    mutationFn: (values: InviteForm) => api(`/lists/${id}/invites`, { method: "POST", body: values }),
    onSuccess: () => {
      inviteForm.reset({ role: "editor" });
      queryClient.invalidateQueries({ queryKey: ["list", id] });
    },
  });

  useEffect(() => {
    if (!token || !id) return;
    const socket = createRealtimeSocket(token);
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["list", id] });

    socket.emit("joinList", { listId: id }, (response: { data?: { participants?: Array<{ userId?: string; name?: string }> } }) => {
      setOnlineParticipants(response?.data?.participants ?? []);
    });
    socket.on("participantsOnline", setOnlineParticipants);
    socket.on("listItemUpdated", invalidate);
    socket.on("itemAssigned", invalidate);
    socket.on("itemPurchased", invalidate);
    socket.on("itemSkipped", invalidate);

    return () => {
      socket.emit("leaveList", { listId: id });
      socket.disconnect();
    };
  }, [id, queryClient, token]);

  if (list.isLoading) return <LoadingState />;
  if (list.isError || !list.data) return <ScreenContainer title="Lista"><ErrorState /></ScreenContainer>;

  const pendingItems = list.data.items.filter((item) => item.status === "pending");
  const activeItems = list.data.items.filter((item) => item.status === "assigned" || item.status === "in_cart");
  const purchasedItems = list.data.items.filter((item) => item.status === "purchased" || item.checked);

  return (
    <ScreenContainer title={list.data.name} subtitle={list.data.description ?? undefined}>
      <OnlineParticipantsBar participants={onlineParticipants.length ? onlineParticipants : list.data.members?.map((member) => ({ userId: member.user.id, name: member.user.name }))} />

      <div className="grid grid-cols-2 gap-2">
        <AppButton icon={<ShoppingCart className="h-5 w-5" />} onClick={() => start.mutate()}>
          Comprar
        </AppButton>
        <AppButton variant="secondary" icon={<Edit className="h-5 w-5" />} onClick={() => navigate(`/app/lists/${id}/edit`)}>
          Editar
        </AppButton>
        <AppButton variant="secondary" icon={<Share2 className="h-5 w-5" />} onClick={() => setInviteOpen((value) => !value)}>
          Compartilhar
        </AppButton>
        <AppButton variant="secondary" icon={<Archive className="h-5 w-5" />} onClick={() => archive.mutate()}>
          Arquivar
        </AppButton>
        <AppButton variant="secondary" icon={<RefreshCcw className="h-5 w-5" />} onClick={() => duplicate.mutate()}>
          Duplicar
        </AppButton>
        <AppButton variant="danger" icon={<Trash2 className="h-5 w-5" />} onClick={() => setDeleteOpen(true)}>
          Excluir
        </AppButton>
      </div>

      {inviteOpen ? (
        <form className="mt-4 space-y-3 rounded-[8px] bg-white p-4 shadow-soft" onSubmit={inviteForm.handleSubmit((values) => invite.mutate(values))}>
          <AppInput label="E-mail" type="email" {...inviteForm.register("inviteEmail")} />
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-ink/80">Permissão</span>
            <select className="h-12 w-full rounded-[8px] border border-ink/10 bg-white px-3" {...inviteForm.register("role")}>
              <option value="editor">Editor</option>
              <option value="viewer">Visualizador</option>
            </select>
          </label>
          <AppButton type="submit" full>
            Criar convite
          </AppButton>
          {list.data.invites?.map((entry) => (
            <p key={entry.id} className="break-all rounded-[8px] bg-paper p-2 text-xs text-ink/60">
              {window.location.origin}/invite/{entry.inviteToken}
            </p>
          ))}
        </form>
      ) : null}

      <div className="mt-4 grid grid-cols-3 gap-2">
        <PriceCard label="Pendentes" value={pendingItems.length} />
        <PriceCard label="Pegando" value={activeItems.length} />
        <PriceCard label="Comprados" value={purchasedItems.length} />
      </div>

      <SectionHeader title="Itens" action={<AppButton variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => navigate(`/app/lists/${id}/edit`)}>Adicionar</AppButton>} />
      <div className="space-y-3">
        {!list.data.items.length ? <EmptyState title="Adicione produtos ao carrinho para começar sua compra." /> : null}
        {list.data.items.map((item) => (
          <div key={item.id} className="rounded-[8px] bg-white p-2 shadow-soft">
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <ListItemRow item={item} onToggle={() => toggleItem.mutate(item.id)} />
              </div>
              <button className="grid h-auto w-11 place-items-center rounded-[8px] bg-white text-tomato shadow-soft" onClick={() => removeItem.mutate(item.id)}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <AppButton className="h-10 px-2 text-xs" variant="secondary" onClick={() => assignItem.mutate(item.id)}>
                Pegando
              </AppButton>
              <AppButton className="h-10 px-2 text-xs" variant="secondary" onClick={() => purchaseListItem.mutate(item.id)}>
                Comprado
              </AppButton>
              <AppButton className="h-10 px-2 text-xs" variant="ghost" onClick={() => skipItem.mutate(item.id)}>
                Pular
              </AppButton>
            </div>
          </div>
        ))}
      </div>

      <SectionHeader title="Membros" />
      <div className="flex gap-2 overflow-x-auto pb-2">
        {list.data.members?.map((member) => (
          <div key={member.id} className="flex min-w-max items-center gap-2 rounded-full bg-white px-2 py-1 shadow-soft">
            <MemberAvatar user={member.user} />
            <span className="text-xs font-semibold text-ink/65">{member.user.name}</span>
          </div>
        ))}
      </div>
      {!list.data.members?.length ? <EmptyState title="Compartilhe esta lista para comprar junto com outra pessoa." /> : null}

      <ConfirmDialog
        open={deleteOpen}
        title="Excluir lista"
        description="Esta lista sera removida. Compras ja finalizadas continuam no historico."
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => remove.mutate()}
      />
    </ScreenContainer>
  );
}

export function CreateEditListPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ["list", id], queryFn: () => api<MarketList>(`/lists/${id}`), enabled: isEdit });
  const form = useForm<ListForm>({ resolver: zodResolver(listSchema), defaultValues: { name: "", description: "" } });
  const itemForm = useForm<{ productName: string; expectedQuantity: number; unit: Unit }>({
    defaultValues: { productName: "", expectedQuantity: 1, unit: "un" },
  });

  useEffect(() => {
    if (list.data) form.reset({ name: list.data.name, description: list.data.description ?? "" });
  }, [list.data, form]);

  const save = useMutation({
    mutationFn: (values: ListForm) =>
      isEdit ? api<MarketList>(`/lists/${id}`, { method: "PUT", body: values }) : api<MarketList>("/lists", { method: "POST", body: values }),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["lists"] });
      navigate(`/app/lists/${saved.id}`);
    },
  });
  const addItem = useMutation({
    mutationFn: (values: { productName: string; expectedQuantity: number; unit: Unit }) =>
      api(`/lists/${id}/items`, { method: "POST", body: values }),
    onSuccess: async () => {
      itemForm.reset({ productName: "", expectedQuantity: 1, unit: "un" });
      await queryClient.invalidateQueries({ queryKey: ["list", id] });
    },
  });

  return (
    <ScreenContainer title={isEdit ? "Editar lista" : "Nova lista"}>
      <form className="space-y-3" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
        <AppInput label="Nome" error={form.formState.errors.name?.message} {...form.register("name")} />
        <AppInput label="Descrição" {...form.register("description")} />
        <AppButton type="submit" full>
          Salvar
        </AppButton>
      </form>

      {isEdit ? (
        <>
          <SectionHeader title="Adicionar item" />
          <form className="grid gap-3 rounded-[8px] bg-white p-4 shadow-soft" onSubmit={itemForm.handleSubmit((values) => addItem.mutate(values))}>
            <AppInput label="Produto" {...itemForm.register("productName", { required: true })} />
            <div className="grid grid-cols-[1fr_120px] gap-2">
              <QuantityInput label="Qtd." {...itemForm.register("expectedQuantity", { valueAsNumber: true })} />
              <UnitSelect label="Un." {...itemForm.register("unit")} />
            </div>
            <AppButton type="submit" full icon={<Plus className="h-4 w-4" />}>
              Adicionar
            </AppButton>
          </form>
        </>
      ) : null}
    </ScreenContainer>
  );
}

export function SharedListPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const accept = useMutation({
    mutationFn: () => api(`/lists/invites/${token}/accept`, { method: "POST" }),
    onSuccess: () => navigate("/app/lists"),
  });

  return (
    <ScreenContainer title="Convite">
      <div className="rounded-[8px] bg-white p-4 shadow-soft">
        <p className="text-sm text-ink/65">Aceite o convite para acessar a lista compartilhada.</p>
        <AppButton className="mt-4" full onClick={() => accept.mutate()}>
          Aceitar convite
        </AppButton>
      </div>
    </ScreenContainer>
  );
}

export function StartPurchasePage() {
  const navigate = useNavigate();
  const lists = useQuery({ queryKey: ["lists"], queryFn: () => api<MarketList[]>("/lists") });
  const active = useQuery({ queryKey: ["active-purchases"], queryFn: () => api<Purchase[]>("/purchases/active") });
  const start = useMutation({
    mutationFn: (payload: { sourceListId?: string; cancelActive?: boolean } = {}) =>
      api<Purchase>("/purchases/start", { method: "POST", body: payload }),
    onSuccess: (purchase) => navigate(`/app/purchase/${purchase.id}`),
  });
  const activePurchase = active.data?.[0];

  return (
    <ScreenContainer title="Iniciar compra">
      {activePurchase ? (
        <div className="mb-4 rounded-[8px] bg-white p-4 shadow-soft">
          <p className="text-sm font-black text-ink">Compra ativa encontrada</p>
          <p className="mt-1 text-xs text-ink/55">{activePurchase.items.length} itens no carrinho</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <AppButton variant="secondary" onClick={() => navigate(`/app/purchase/${activePurchase.id}`)}>
              Continuar
            </AppButton>
            <AppButton variant="danger" onClick={() => start.mutate({ cancelActive: true })}>
              Cancelar e iniciar
            </AppButton>
          </div>
        </div>
      ) : null}
      <AppButton full icon={<ShoppingCart className="h-5 w-5" />} onClick={() => start.mutate({})}>
        Começar do zero
      </AppButton>
      <SectionHeader title="A partir de lista" />
      <div className="space-y-3">
        {lists.data?.map((list) => (
          <MarketListCard key={list.id} list={list} onClick={() => start.mutate({ sourceListId: list.id })} />
        ))}
        {!lists.isLoading && !lists.data?.length ? <EmptyState title="Você ainda não tem listas. Crie sua primeira lista de mercado." /> : null}
      </div>
    </ScreenContainer>
  );
}

export function ActivePurchasePage() {
  const routeParams = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const purchaseId = routeParams.purchaseId ?? params.get("purchaseId");
  const active = useQuery({ queryKey: ["active-purchases"], queryFn: () => api<Purchase[]>("/purchases/active") });
  const purchase = useMemo(() => active.data?.find((entry) => entry.id === purchaseId) ?? active.data?.[0], [active.data, purchaseId]);
  const cancel = useMutation({
    mutationFn: () => api(`/purchases/${purchase?.id}/cancel`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["active-purchases"] }),
  });

  useEffect(() => {
    if (!token || !purchase?.id) return;
    const socket = createRealtimeSocket(token);
    socket.emit("joinPurchase", { purchaseId: purchase.id });
    socket.on("purchaseItemCreated", () => queryClient.invalidateQueries({ queryKey: ["active-purchases"] }));
    socket.on("purchaseItemUpdated", () => queryClient.invalidateQueries({ queryKey: ["active-purchases"] }));
    socket.on("purchaseItemDeleted", () => queryClient.invalidateQueries({ queryKey: ["active-purchases"] }));
    socket.on("purchaseTotalUpdated", () => queryClient.invalidateQueries({ queryKey: ["active-purchases"] }));
    return () => {
      socket.emit("leavePurchase", { purchaseId: purchase.id });
      socket.disconnect();
    };
  }, [purchase?.id, queryClient, token]);

  if (active.isLoading) return <LoadingState />;
  if (!purchase) {
    return (
      <ScreenContainer title="Compra ativa">
        <EmptyState title="Adicione produtos ao carrinho para começar sua compra." action={<AppButton onClick={() => navigate("/app/purchase/start")}>Iniciar compra</AppButton>} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer title="Compra ativa" subtitle={purchase.sourceList?.name ?? undefined}>
      <div className="sticky top-0 z-20 -mx-4 mb-4 bg-paper/95 px-4 py-3 backdrop-blur">
        <div className="rounded-[8px] bg-ink p-4 text-white shadow-soft">
          <p className="text-xs font-semibold text-white/60">Total atual</p>
          <p className="text-3xl font-black">{formatBRL(purchase.subtotalCalculated)}</p>
        </div>
      </div>

      <OnlineParticipantsBar participants={purchase.participants} />

      <div className="mt-4 grid grid-cols-2 gap-2">
        <AppButton variant="secondary" icon={<Check className="h-4 w-4" />} onClick={() => navigate(`/app/purchase/${purchase.id}/finish`)}>
          Finalizar
        </AppButton>
        <AppButton variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => cancel.mutate()}>
          Cancelar
        </AppButton>
      </div>

      <SectionHeader title="Carrinho" />
      <div className="space-y-3">
        {!purchase.items.length ? <EmptyState title="Adicione produtos ao carrinho para começar sua compra." /> : null}
        {purchase.items.map((item) => (
          <PurchaseItemCard key={item.id} item={item} action={<CartItemActions purchaseId={purchase.id} item={item} />} />
        ))}
      </div>
      <FloatingActionButton label="Produto" onClick={() => navigate(`/app/purchase/${purchase.id}/item`)} />
    </ScreenContainer>
  );
}

function CartItemActions({ purchaseId, item }: { purchaseId: string; item: PurchaseItem }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => api(`/purchases/${purchaseId}/items/${item.id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["active-purchases"] }),
  });

  return (
    <div className="flex gap-1">
      <button
        type="button"
        className="grid h-10 w-10 place-items-center rounded-[8px] bg-ink/5 text-ink"
        onClick={() => navigate(`/app/purchase/${purchaseId}/item?itemId=${item.id}`)}
        aria-label="Editar item"
      >
        <Edit className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="grid h-10 w-10 place-items-center rounded-[8px] bg-tomato/10 text-tomato"
        onClick={() => remove.mutate()}
        aria-label="Remover item"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export function AddEditCartItemPage() {
  const routeParams = useParams();
  const [params] = useSearchParams();
  const purchaseId = routeParams.purchaseId ?? params.get("purchaseId") ?? "";
  const itemId = params.get("itemId");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [productName, setProductName] = useState("");
  const active = useQuery({ queryKey: ["active-purchases"], queryFn: () => api<Purchase[]>("/purchases/active") });
  const purchase = active.data?.find((entry) => entry.id === purchaseId);
  const editingItem = purchase?.items.find((item) => item.id === itemId);
  const form = useForm<CartItemForm>({
    resolver: zodResolver(cartItemSchema),
    defaultValues: { productName: "", quantity: 1, unit: "un", pricePaid: 0 },
  });
  useEffect(() => {
    if (!editingItem) return;
    setProductName(editingItem.productName);
    form.reset({
      productId: editingItem.productId ?? undefined,
      productName: editingItem.productName,
      brand: editingItem.brand ?? "",
      category: editingItem.category ?? "",
      quantity: editingItem.quantity,
      unit: editingItem.unit,
      pricePaid: editingItem.pricePaid,
      notes: editingItem.notes ?? "",
    });
  }, [editingItem, form]);
  const save = useMutation({
    mutationFn: (values: CartItemForm) =>
      itemId
        ? api<Purchase>(`/purchases/${purchaseId}/items/${itemId}`, { method: "PUT", body: values })
        : api<Purchase>(`/purchases/${purchaseId}/items`, { method: "POST", body: values }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["active-purchases"] });
      navigate(`/app/purchase/${purchaseId}`);
    },
  });

  return (
    <ScreenContainer title={itemId ? "Editar produto" : "Produto"}>
      <form className="space-y-3" onSubmit={form.handleSubmit((values) => save.mutate({ ...values, productName }))}>
        <ProductSearchInput
          value={productName}
          onChange={(value) => {
            setProductName(value);
            form.setValue("productName", value);
          }}
          onSelect={(product) => {
            form.setValue("productId", product.id);
            form.setValue("brand", product.brand ?? "");
            form.setValue("category", product.category ?? "");
            form.setValue("unit", product.defaultUnit);
          }}
        />
        <div className="grid grid-cols-[1fr_120px] gap-2">
          <QuantityInput label="Quantidade" error={form.formState.errors.quantity?.message} {...form.register("quantity")} />
          <UnitSelect label="Unidade" {...form.register("unit")} />
        </div>
        <MoneyInput label="Preço pago" error={form.formState.errors.pricePaid?.message} {...form.register("pricePaid")} />
        <AppInput label="Marca" {...form.register("brand")} />
        <AppInput label="Categoria" {...form.register("category")} />
        <AppInput label="Observações" {...form.register("notes")} />
        <label className="flex items-center gap-2 rounded-[8px] bg-white p-3 text-sm font-semibold text-ink/65 shadow-soft">
          <input type="checkbox" defaultChecked={!form.watch("productId")} />
          Salvar produto na minha base
        </label>
        <AppButton type="submit" full icon={<Plus className="h-4 w-4" />}>
          {itemId ? "Salvar" : "Adicionar"}
        </AppButton>
      </form>
    </ScreenContainer>
  );
}

export function FinishPurchasePage() {
  const routeParams = useParams();
  const [params] = useSearchParams();
  const purchaseId = routeParams.purchaseId ?? params.get("purchaseId");
  const navigate = useNavigate();
  const active = useQuery({ queryKey: ["active-purchases"], queryFn: () => api<Purchase[]>("/purchases/active") });
  const purchase = active.data?.find((entry) => entry.id === purchaseId) ?? active.data?.[0];
  const form = useForm<FinishForm>({
    resolver: zodResolver(finishSchema),
    values: { marketId: "", finalPaidAmount: purchase?.subtotalCalculated ?? 0, notes: "" },
  });
  const finish = useMutation({
    mutationFn: (values: FinishForm) => api<Purchase>(`/purchases/${purchase?.id}/finish`, { method: "POST", body: values }),
    onSuccess: (saved) => navigate(`/app/history/${saved.id}`),
  });

  if (!purchase) return <LoadingState />;
  const finalPaidAmount = Number(form.watch("finalPaidAmount") ?? 0);
  const difference = purchase.subtotalCalculated - finalPaidAmount;

  return (
    <ScreenContainer title="Finalizar">
      <div className="mb-4 rounded-[8px] bg-ink p-4 text-white shadow-soft">
        <p className="text-xs text-white/60">Subtotal calculado</p>
        <p className="text-3xl font-black">{formatBRL(purchase.subtotalCalculated)}</p>
      </div>
      <form className="space-y-3" onSubmit={form.handleSubmit((values) => finish.mutate(values))}>
        <MarketSelect value={form.watch("marketId")} onChange={(value) => form.setValue("marketId", value, { shouldValidate: true })} />
        <MoneyInput label="Valor pago no caixa" error={form.formState.errors.finalPaidAmount?.message} {...form.register("finalPaidAmount")} />
        <AppInput label="Observações" {...form.register("notes")} />
        <div className="rounded-[8px] bg-white p-3 shadow-soft">
          <p className="text-xs font-semibold text-ink/50">Desconto/diferenca</p>
          <p className={difference >= 0 ? "text-lg font-black text-mint" : "text-lg font-black text-tomato"}>{formatBRL(difference)}</p>
          {difference < 0 ? <p className="mt-1 text-xs text-tomato">Diferenca positiva, talvez algum item nao tenha sido lancado.</p> : null}
        </div>
        <AppButton type="submit" full>
          Salvar compra
        </AppButton>
      </form>
    </ScreenContainer>
  );
}

export function PurchaseHistoryPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const { data = [], isLoading } = useQuery({ queryKey: ["purchases"], queryFn: () => api<Purchase[]>("/purchases") });
  const completed = data
    .filter((purchase) => purchase.status === "completed")
    .filter((purchase) => {
      const term = q.toLowerCase();
      if (!term) return true;
      return purchase.market?.name.toLowerCase().includes(term) || purchase.items.some((item) => item.productName.toLowerCase().includes(term));
    });

  return (
    <ScreenContainer title="Histórico">
      <SearchBar placeholder="Buscar mercado ou produto" value={q} onChange={(event) => setQ(event.target.value)} />
      <div className="mt-3">
        <DateRangeFilter />
      </div>
      {isLoading ? <LoadingState /> : null}
      {!isLoading && !completed.length ? <EmptyState title="Nenhuma compra registrada ainda." /> : null}
      <div className="space-y-3">
        {completed.map((purchase) => (
          <button key={purchase.id} onClick={() => navigate(`/app/history/${purchase.id}`)} className="w-full rounded-[8px] bg-white p-4 text-left shadow-soft">
            <p className="text-sm font-black text-ink">{purchase.market?.name ?? "Mercado"}</p>
            <p className="mt-1 text-xs text-ink/55">
              {new Date(purchase.completedAt ?? purchase.startedAt).toLocaleDateString("pt-BR")} ·{" "}
              {formatBRL(purchase.finalPaidAmount ?? purchase.subtotalCalculated)}
            </p>
          </button>
        ))}
      </div>
      <div className="mt-4">
        <AdSlot />
      </div>
    </ScreenContainer>
  );
}

export function PurchaseDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const purchase = useQuery({ queryKey: ["purchase", id], queryFn: () => api<Purchase>(`/purchases/${id}`), enabled: Boolean(id) });
  const duplicate = useMutation({
    mutationFn: () => api<MarketList>(`/purchases/${id}/duplicate-as-list`, { method: "POST" }),
    onSuccess: (list) => navigate(`/app/lists/${list.id}`),
  });

  if (purchase.isLoading) return <LoadingState />;
  if (!purchase.data) return <ScreenContainer title="Compra"><ErrorState /></ScreenContainer>;

  return (
    <ScreenContainer title={purchase.data.market?.name ?? "Compra"} subtitle={new Date(purchase.data.startedAt).toLocaleDateString("pt-BR")}>
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label="Total" value={formatBRL(purchase.data.finalPaidAmount ?? purchase.data.subtotalCalculated)} />
        <SummaryCard label="Desconto" value={formatBRL(purchase.data.discountAmount ?? 0)} tone="tomato" />
      </div>
      <SectionHeader title="Itens" action={<AppButton variant="secondary" icon={<RefreshCcw className="h-4 w-4" />} onClick={() => duplicate.mutate()}>Virar lista</AppButton>} />
      <div className="space-y-3">
        {purchase.data.items.map((item) => (
          <PurchaseItemCard key={item.id} item={item} />
        ))}
      </div>
    </ScreenContainer>
  );
}

export function PriceComparisonPage() {
  const [q, setQ] = useState("");
  const { user } = useAuth();
  const comparison = useQuery({
    queryKey: ["price-comparison", q],
    queryFn: () => api<PriceComparison[]>(`/reports/products-price-comparison?q=${encodeURIComponent(q)}`),
  });

  return (
    <ScreenContainer title="Comparar preços">
      <SearchBar placeholder="Buscar produto" value={q} onChange={(event) => setQ(event.target.value)} />
      <DateRangeFilter />
      <div className="mt-4 space-y-3">
        {!comparison.isLoading && !comparison.data?.length ? <EmptyState title="Cadastre seus mercados para comparar preços." /> : null}
        {comparison.data?.map((entry) => (
          <div key={entry.productName} className="rounded-[8px] bg-white p-4 shadow-soft">
            <p className="font-black text-ink">{entry.productName}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <PriceCard label="Menor" value={formatBRL(entry.minPrice ?? 0)} />
              <PriceCard label="Média" value={formatBRL(entry.averagePrice ?? 0)} />
              <PriceCard label="Maior" value={formatBRL(entry.maxPrice ?? 0)} />
              <PriceCard label="Último mercado" value={entry.lastMarket ?? "-"} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <AdSlot />
      </div>
    </ScreenContainer>
  );
}

export function ProductPriceDetailPage() {
  const { productId = "" } = useParams();
  const history = useQuery({ queryKey: ["price-history", productId], queryFn: () => api(`/reports/products/${productId}/price-history`) });
  const markets = useQuery({ queryKey: ["markets-comparison", productId], queryFn: () => api<Array<{ marketName: string; averagePrice: number }>>(`/reports/products/${productId}/markets-comparison`) });
  const best = useQuery({ queryKey: ["best-market", productId], queryFn: () => api<{ marketName: string; averagePrice: number } | null>(`/reports/products/${productId}/best-market`) });

  return (
    <ScreenContainer title="Preço do produto">
      <SummaryCard label="Melhor mercado" value={best.data ? `${best.data.marketName} · ${formatBRL(best.data.averagePrice)}` : "-"} />
      <SectionHeader title="Mercados" />
      <div className="space-y-2">
        {markets.data?.map((entry) => (
          <PriceCard key={entry.marketName} label={entry.marketName} value={formatBRL(entry.averagePrice)} />
        ))}
      </div>
      <SectionHeader title="Histórico" />
      <pre className="overflow-auto rounded-[8px] bg-white p-3 text-xs text-ink/60">{JSON.stringify(history.data ?? [], null, 2)}</pre>
    </ScreenContainer>
  );
}

export function MarketsPage() {
  const navigate = useNavigate();
  const { data = [], isLoading } = useQuery({ queryKey: ["markets"], queryFn: () => api<Market[]>("/markets") });

  return (
    <ScreenContainer title="Mercados">
      {isLoading ? <LoadingState /> : null}
      {!isLoading && !data.length ? <EmptyState title="Cadastre seus mercados para comparar preços." /> : null}
      <div className="space-y-3">
        {data.map((market) => (
          <MarketCard key={market.id} market={market} onClick={() => navigate(`/app/markets/${market.id}`)} />
        ))}
      </div>
      <FloatingActionButton label="Mercado" onClick={() => navigate("/app/markets/new")} />
    </ScreenContainer>
  );
}

export function MarketDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const summary = useQuery({ queryKey: ["market-summary", id], queryFn: () => api<{ market: Market; purchaseCount: number; totalSpent: number; averageTicket: number; topProduct: string | null }>(`/markets/${id}/summary`) });
  const remove = useMutation({
    mutationFn: () => api(`/markets/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["markets"] });
      navigate("/app/markets");
    },
  });

  if (summary.isLoading) return <LoadingState />;
  if (!summary.data) return <ScreenContainer title="Mercado"><ErrorState /></ScreenContainer>;

  return (
    <ScreenContainer title={summary.data.market.name} subtitle={summary.data.market.city ?? undefined}>
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label="Total" value={formatBRL(summary.data.totalSpent)} />
        <SummaryCard label="Compras" value={summary.data.purchaseCount} tone="sky" />
        <SummaryCard label="Ticket" value={formatBRL(summary.data.averageTicket)} tone="leaf" />
        <SummaryCard label="Produto" value={summary.data.topProduct ?? "-"} tone="tomato" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <AppButton full variant="secondary" icon={<Edit className="h-4 w-4" />} onClick={() => navigate(`/app/markets/${id}/edit`)}>
          Editar
        </AppButton>
        <AppButton full variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteOpen(true)}>
          Excluir
        </AppButton>
      </div>
      <ConfirmDialog
        open={deleteOpen}
        title="Excluir mercado"
        description="O mercado sera removido da sua lista. Compras antigas continuam no historico."
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => remove.mutate()}
      />
    </ScreenContainer>
  );
}

export function CreateEditMarketPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const market = useQuery({ queryKey: ["market", id], queryFn: () => api<Market>(`/markets/${id}`), enabled: isEdit });
  const form = useForm<MarketForm>({ resolver: zodResolver(marketSchema), defaultValues: { name: "", address: "", city: "", notes: "" } });

  useEffect(() => {
    if (market.data) form.reset({ name: market.data.name, address: market.data.address ?? "", city: market.data.city ?? "", notes: market.data.notes ?? "" });
  }, [market.data, form]);

  const save = useMutation({
    mutationFn: (values: MarketForm) => (isEdit ? api<Market>(`/markets/${id}`, { method: "PUT", body: values }) : api<Market>("/markets", { method: "POST", body: values })),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["markets"] });
      navigate(`/app/markets/${saved.id}`);
    },
  });

  return (
    <ScreenContainer title={isEdit ? "Editar mercado" : "Novo mercado"}>
      <form className="space-y-3" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
        <AppInput label="Nome" error={form.formState.errors.name?.message} {...form.register("name")} />
        <AppInput label="Endereço" {...form.register("address")} />
        <AppInput label="Cidade" {...form.register("city")} />
        <AppInput label="Observações" {...form.register("notes")} />
        <AppButton full type="submit">
          Salvar
        </AppButton>
      </form>
    </ScreenContainer>
  );
}

export function ProductsPage() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const { data = [], isLoading } = useQuery({ queryKey: ["products", q], queryFn: () => api<Product[]>(`/products?q=${encodeURIComponent(q)}`) });

  return (
    <ScreenContainer title="Produtos">
      <SearchBar placeholder="Buscar produto" value={q} onChange={(event) => setQ(event.target.value)} />
      <div className="mt-4 space-y-3">
        {isLoading ? <LoadingState /> : null}
        {!isLoading && !data.length ? <EmptyState title="Cadastre produtos para reutilizar no carrinho." /> : null}
        {data.map((product) => (
          <ProductCard key={product.id} product={product} onClick={() => navigate(`/app/products/${product.id}/edit`)} />
        ))}
      </div>
      <FloatingActionButton label="Produto" onClick={() => navigate("/app/products/new")} />
    </ScreenContainer>
  );
}

export function CreateEditProductPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const product = useQuery({ queryKey: ["product", id], queryFn: () => api<Product>(`/products/${id}`), enabled: isEdit });
  const form = useForm<ProductForm>({ resolver: zodResolver(productSchema), defaultValues: { name: "", brand: "", category: "", defaultUnit: "un", barcode: "" } });

  useEffect(() => {
    if (product.data) {
      form.reset({
        name: product.data.name,
        brand: product.data.brand ?? "",
        category: product.data.category ?? "",
        defaultUnit: product.data.defaultUnit,
        barcode: product.data.barcode ?? "",
      });
    }
  }, [product.data, form]);

  const save = useMutation({
    mutationFn: (values: ProductForm) => (isEdit ? api<Product>(`/products/${id}`, { method: "PUT", body: values }) : api<Product>("/products", { method: "POST", body: values })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      navigate("/app/products");
    },
  });
  const remove = useMutation({
    mutationFn: () => api(`/products/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      navigate("/app/products");
    },
  });

  return (
    <ScreenContainer title={isEdit ? "Editar produto" : "Novo produto"}>
      <form className="space-y-3" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
        <AppInput label="Nome" error={form.formState.errors.name?.message} {...form.register("name")} />
        <AppInput label="Marca" {...form.register("brand")} />
        <AppInput label="Categoria" {...form.register("category")} />
        <UnitSelect label="Unidade padrão" {...form.register("defaultUnit")} />
        <AppInput label="Código de barras" {...form.register("barcode")} />
        <AppButton full type="submit">
          Salvar
        </AppButton>
      </form>
      {isEdit ? (
        <AppButton className="mt-3" full variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteOpen(true)}>
          Excluir produto
        </AppButton>
      ) : null}
      <ConfirmDialog
        open={deleteOpen}
        title="Excluir produto"
        description="O produto sera removido da sua base. Historico de compras permanece preservado."
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => remove.mutate()}
      />
    </ScreenContainer>
  );
}

export function InsightsPage() {
  const monthly = useQuery({ queryKey: ["monthly-spending"], queryFn: () => api<Array<{ month: string; total: number }>>("/reports/monthly-spending") });
  const markets = useQuery({ queryKey: ["markets-ranking"], queryFn: () => api<Array<{ marketName: string; total: number }>>("/reports/markets-ranking") });
  const products = useQuery({ queryKey: ["most-products"], queryFn: () => api<Array<{ productName: string; quantity: number }>>("/reports/most-purchased-products") });
  const variation = useQuery({ queryKey: ["price-variation"], queryFn: () => api<Array<{ productName: string; variation: number }>>("/reports/highest-price-variation") });

  return (
    <ScreenContainer title="Insights">
      <AdSlot />
      <SectionHeader title="Gasto mensal" />
      <div className="space-y-2">
        {monthly.data?.map((entry) => <PriceCard key={entry.month} label={entry.month} value={formatBRL(entry.total)} />)}
      </div>
      <SectionHeader title="Mercados" />
      <div className="space-y-2">
        {markets.data?.map((entry) => <PriceCard key={entry.marketName} label={entry.marketName} value={formatBRL(entry.total)} />)}
      </div>
      <SectionHeader title="Produtos" />
      <div className="space-y-2">
        {products.data?.map((entry) => <PriceCard key={entry.productName} label={entry.productName} value={`${entry.quantity}`} />)}
      </div>
      <SectionHeader title="Variacao" />
      <div className="space-y-2">
        {variation.data?.map((entry) => <PriceCard key={entry.productName} label={entry.productName} value={formatBRL(entry.variation)} />)}
      </div>
    </ScreenContainer>
  );
}

export function BillingPage() {
  const { refreshUser } = useAuth();
  const { status, hasNoAds, refreshBillingStatus } = useAds();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const offer = status?.availableOffers[0];
  const checkout = useMutation({
    mutationFn: () => api<{ checkoutUrl: string; purchaseId: string }>("/billing/remove-ads/checkout", { method: "POST" }),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["billing-status"] });
      await refreshBillingStatus();
      await refreshUser();
      window.location.href = response.checkoutUrl;
    },
  });

  return (
    <ScreenContainer title="Remover anuncios">
      <div className="mb-4 flex items-center justify-between rounded-[8px] bg-white p-3 shadow-soft">
        <span className="text-sm font-semibold text-ink/65">Status</span>
        <MonetizationBadge hasNoAds={hasNoAds} />
      </div>

      {hasNoAds ? (
        <div className="rounded-[8px] bg-white p-4 shadow-soft">
          <p className="text-lg font-black text-ink">Sem anuncios ativo</p>
          <p className="mt-2 text-sm text-ink/60">Voce nao vera mais anuncios no Gondly.</p>
          <AppButton className="mt-4" full onClick={() => navigate("/app/home")}>
            Voltar para o app
          </AppButton>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-[8px] bg-white p-4 shadow-soft">
            <p className="text-lg font-black text-ink">{offer?.title ?? "Gondly Sem Anuncios"}</p>
            <p className="mt-2 text-sm text-ink/60">Use o Gondly com uma experiencia mais limpa. Pague uma vez e nao veja mais anuncios.</p>
            <p className="mt-4 text-2xl font-black text-mint">{formatBRL(offer?.price ?? 19.9)}</p>
            <p className="mt-2 text-xs text-ink/50">Este pagamento remove apenas os anuncios. Recursos futuros poderao ser vendidos separadamente.</p>
            <AppButton className="mt-4" full onClick={() => checkout.mutate()} disabled={checkout.isPending}>
              {checkout.isPending ? "Abrindo checkout" : `Remover anuncios por ${formatBRL(offer?.price ?? 19.9)}`}
            </AppButton>
          </div>
          <div className="rounded-[8px] border border-dashed border-ink/15 bg-white/70 p-3 text-xs font-semibold text-ink/50">
            O app continua gratuito com anuncios.
          </div>
        </div>
      )}
    </ScreenContainer>
  );
}

export function BillingSuccessPage() {
  return <BillingReturnPage title="Pagamento recebido!" description="Estamos atualizando seu acesso." successLabel="Anuncios removidos com sucesso." />;
}

export function BillingPendingPage() {
  return <BillingReturnPage title="Pagamento pendente." description="Assim que o pagamento for confirmado, os anuncios serao removidos automaticamente." />;
}

export function BillingFailurePage() {
  const navigate = useNavigate();
  return (
    <ScreenContainer title="Pagamento nao concluido">
      <div className="rounded-[8px] bg-white p-4 shadow-soft">
        <p className="text-sm text-ink/60">Voce pode tentar novamente quando quiser.</p>
        <AppButton className="mt-4" full onClick={() => navigate("/app/billing")}>
          Tentar novamente
        </AppButton>
      </div>
    </ScreenContainer>
  );
}

export function SettingsPage() {
  const { user, logout } = useAuth();
  const { hasNoAds } = useAds();
  const navigate = useNavigate();

  return (
    <ScreenContainer title="Ajustes">
      <div className="rounded-[8px] bg-white p-4 shadow-soft">
        <div className="flex items-center gap-3">
          <MemberAvatar user={(user as User) ?? { name: "U" }} />
          <div>
            <p className="text-sm font-black text-ink">{user?.name}</p>
            <p className="text-xs text-ink/55">{user?.email}</p>
          </div>
        </div>

        <SectionHeader title="Monetizacao" />
        <div className="rounded-[8px] border border-ink/10 bg-paper p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-ink/60">Status</p>
            <MonetizationBadge hasNoAds={hasNoAds} />
          </div>
          {hasNoAds ? (
            <p className="mt-2 text-xs text-ink/55">Anuncios removidos para sempre.</p>
          ) : (
            <AppButton className="mt-3" full variant="secondary" onClick={() => navigate("/app/billing")}>
              Remover anuncios
            </AppButton>
          )}
        </div>

        <div className="mt-4 grid gap-2">
          <AppButton variant="danger" icon={<LogOut className="h-4 w-4" />} onClick={logout}>
            Sair
          </AppButton>
        </div>
      </div>
    </ScreenContainer>
  );
}

function BillingReturnPage({ title, description, successLabel }: { title: string; description: string; successLabel?: string }) {
  const navigate = useNavigate();
  const { hasNoAds, refreshBillingStatus } = useAds();
  const { refreshUser } = useAuth();

  async function refresh() {
    await refreshBillingStatus();
    await refreshUser();
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <ScreenContainer title={title}>
      <div className="rounded-[8px] bg-white p-4 shadow-soft">
        <p className="text-sm text-ink/60">{hasNoAds && successLabel ? successLabel : description}</p>
        <div className="mt-4 grid gap-2">
          <AppButton full onClick={refresh}>
            Atualizar status
          </AppButton>
          <AppButton full variant="secondary" onClick={() => navigate("/app/home")}>
            Voltar para o app
          </AppButton>
        </div>
      </div>
    </ScreenContainer>
  );
}

function Shortcut({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <Link to={to} className="flex h-24 flex-col justify-between rounded-[8px] bg-white p-4 text-ink shadow-soft">
      <span className="grid h-9 w-9 place-items-center rounded-[8px] bg-mint/12 text-mint">{icon}</span>
      <span className="text-sm font-black">{label}</span>
    </Link>
  );
}

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (element: HTMLElement | null, options: { theme: string; size: string; width: number }) => void;
        };
      };
    };
  }
}
