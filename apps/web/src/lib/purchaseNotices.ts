import { ApiError } from "./api";

const PURCHASE_ERROR_EVENT = "gondly:purchase-error";

type PurchaseErrorDetail = { purchaseId: string; message: string };

// Cart writes are optimistic and the form closes before the request ends, so failures are reported to the
// active purchase screen through this event instead of the (already unmounted) form.
export function notifyPurchaseError(purchaseId: string, error: unknown) {
  window.dispatchEvent(new CustomEvent<PurchaseErrorDetail>(PURCHASE_ERROR_EVENT, { detail: { purchaseId, message: purchaseErrorMessage(error) } }));
}

export function onPurchaseError(listener: (detail: PurchaseErrorDetail) => void) {
  const handler = (event: Event) => listener((event as CustomEvent<PurchaseErrorDetail>).detail);
  window.addEventListener(PURCHASE_ERROR_EVENT, handler);
  return () => window.removeEventListener(PURCHASE_ERROR_EVENT, handler);
}

function purchaseErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 403) return "Você não tem permissão para editar esta compra.";
    if (error.status === 404) return "Não foi possível salvar o item: ele não está mais disponível nesta compra.";
    if (error.status === 400) return "Esta compra não pode mais ser editada.";
  }
  return "Não foi possível salvar o item. Tente novamente.";
}
