import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { enablePushNotifications } from "../../lib/push";
import type { Unit } from "@gondly/types";
type Setting = {enabled:boolean;intervalDays:number;nextReminderAt:string;quietStart:number;quietEnd:number;timeZone:string};
type Suggestion = {key:string;productName:string;brand:string|null;unit:Unit;packageSize:number|null;packageUnit:Unit|null;expectedQuantity:number;explanation:string};
export function ReplenishmentPanel({listId,onRecurringChange}:{listId:string;onRecurringChange:(value:boolean)=>void}) {
 const client=useQueryClient();const path=`/lists/${listId}/replenishment`;
 const setting=useQuery({queryKey:["replenishment",listId],queryFn:()=>api<Setting|null>(path)});
 const suggestions=useQuery({queryKey:["replenishment-suggestions",listId],queryFn:()=>api<Suggestion[]>(`${path}/suggestions`)});
 const [days,setDays]=useState(7);const [date,setDate]=useState(()=>localDate(new Date(Date.now()+7*86400000)));const [start,setStart]=useState(23);const [end,setEnd]=useState(7);const [message,setMessage]=useState("");
 useEffect(()=>{onRecurringChange(Boolean(setting.data?.enabled));if(setting.data){setDays(setting.data.intervalDays);setDate(localDate(new Date(setting.data.nextReminderAt)));setStart(setting.data.quietStart);setEnd(setting.data.quietEnd);}},[setting.data,onRecurringChange]);
 const action=useMutation({mutationFn:async (kind:"save"|"cancel"|Suggestion)=>{
  if(kind==="save")return api(path,{method:"PUT",body:{enabled:true,intervalDays:days,nextReminderAt:new Date(date).toISOString(),quietStart:start,quietEnd:end,timeZone:setting.data?.timeZone??Intl.DateTimeFormat().resolvedOptions().timeZone}});
  if(kind==="cancel")return api(path,{method:"DELETE"});
  return api(`${path}/dismiss`,{body:{key:kind.key}});
 },onSuccess:()=>{setMessage("Preferências atualizadas.");void client.invalidateQueries({queryKey:["replenishment",listId]});void client.invalidateQueries({queryKey:["replenishment-suggestions",listId]});},onError:(e:Error)=>setMessage(e.message)});
 const add=useMutation({mutationFn:async (item:Suggestion)=>{await api(`${path}/accept`,{body:{key:item.key}});},onSuccess:()=>{void client.invalidateQueries({queryKey:["replenishment-suggestions",listId]});void client.invalidateQueries({queryKey:["list",listId]});setMessage("Item adicionado. Revise a quantidade antes de comprar.");},onError:(e:Error)=>setMessage(e.message)});
 return <details className="mt-4 rounded-xl border border-line bg-white p-4" open={new URLSearchParams(window.location.search).has("review")||undefined}>
 <summary className="cursor-pointer font-bold">Próxima compra e reposição {setting.data?.enabled?"· recorrente":""}</summary>
 <p className="my-3 text-sm text-muted">Reutilize esta lista e revise itens, quantidades e o que já tem em casa. Lembretes são pessoais e nunca iniciam uma compra.</p>
 <div className="grid gap-3 sm:grid-cols-2">
 <label className="text-sm">Frequência em dias<input className="mt-1 w-full rounded border p-2" type="number" min={1} max={365} value={days} onChange={e=>setDays(Number(e.target.value))}/></label>
 <label className="text-sm">Próximo lembrete<input className="mt-1 w-full rounded border p-2" type="datetime-local" value={date} onChange={e=>setDate(e.target.value)}/></label>
 <label className="text-sm">Silêncio a partir de (hora)<input className="mt-1 w-full rounded border p-2" type="number" min={0} max={23} value={start} onChange={e=>setStart(Number(e.target.value))}/></label>
 <label className="text-sm">Até (hora)<input className="mt-1 w-full rounded border p-2" type="number" min={0} max={23} value={end} onChange={e=>setEnd(Number(e.target.value))}/></label>
 </div>
 <p className="my-2 text-xs text-muted">Fuso: {setting.data?.timeZone??Intl.DateTimeFormat().resolvedOptions().timeZone}. Horas iguais desativam o silêncio.</p>
 <div className="flex flex-wrap gap-3 text-sm font-bold"><button disabled={action.isPending||!date||days<1||days>365} onClick={()=>action.mutate("save")}>Salvar recorrência</button><button disabled={action.isPending} onClick={()=>action.mutate("cancel")}>Interromper lembretes</button><button onClick={()=>void enablePushNotifications().then(result=>setMessage(result==="enabled"?"Notificações ativadas.":`Notificações: ${result}`)).catch((e:Error)=>setMessage(e.message))}>Ativar notificações neste aparelho</button></div>
 {setting.isError||suggestions.isError?<p role="alert">Não foi possível carregar a reposição. Tente novamente.</p>:null}
 {message?<p role="status" className="my-2 text-sm">{message}</p>:null}
 <h3 className="mt-4 font-bold">Sugestões do seu histórico</h3>
 {!suggestions.data?.length?<p className="mt-1 text-sm text-muted">Sem novas sugestões. São necessárias ao menos duas compras com o mesmo item.</p>:null}
 {suggestions.data?.map(item=><div key={item.key} className="mt-3 border-t pt-3 text-sm"><strong>{item.productName} {item.brand??""}</strong><p>{item.expectedQuantity} {item.unit} · {item.packageSize?`${item.packageSize} ${item.packageUnit??""}`:"sem embalagem informada"}</p><p className="text-muted">{item.explanation}</p><div className="mt-2 flex gap-4"><button disabled={add.isPending} onClick={()=>add.mutate(item)}>Adicionar à lista</button><button disabled={action.isPending} onClick={()=>action.mutate(item)}>Dispensar sugestão</button></div></div>)}
 </details>;
}
function localDate(value:Date){return new Date(value.getTime()-value.getTimezoneOffset()*60000).toISOString().slice(0,16);}
