import assert from "node:assert/strict";
import { test } from "node:test";
import webpush from "web-push";
import { PushService } from "../src/push/push.service";
import { ReplenishmentService } from "../src/replenishment/replenishment.service";
const noon=new Date("2026-10-28T15:00:00Z");
function scheduler(options:{quiet?:boolean;revoked?:boolean;subscription?:boolean;cas?:boolean}={}) {
 const calls:{reserved:number;sent:number;disabled:number}={reserved:0,sent:0,disabled:0};let claimed=false;
 const due={id:"r",userId:"u",listId:"l",enabled:true,intervalDays:7,nextReminderAt:noon,updatedAt:noon,quietStart:options.quiet?0:23,quietEnd:options.quiet?23:7,timeZone:"America/Sao_Paulo",list:{userId:options.revoked?"other":"u",name:"Lista",members:[]}};
 const prisma={listReplenishment:{findMany:async()=>[due],updateMany:async({data}:any)=>{if(data.enabled===false){calls.disabled++;return {count:1};}calls.reserved++;if(claimed||options.cas===false)return {count:0};claimed=true;return {count:1};}},pushSubscription:{count:async()=>options.subscription===false?0:1,findMany:async()=>[{id:"s",endpoint:"https://example.test",p256dh:"x",auth:"x"}],update:async()=>{}}};
 const service=new PushService(prisma as never,{get:()=>undefined} as never);
 (service as unknown as {publicKey:string}).publicKey="configured";
 return {service,calls};
}
test("overlapping recurrence workers reserve once and send a single reminder",async()=>{
 const {service,calls}=scheduler();const original=webpush.sendNotification;webpush.sendNotification=(async()=>{calls.sent++;return {};}) as never;
 try {await Promise.all([service.runReplenishmentReminders(noon),service.runReplenishmentReminders(noon)]);assert.equal(calls.sent,1);}finally{webpush.sendNotification=original;}
});
test("quiet hours and absent push permission do not consume recurrence",async()=>{
 for(const options of [{quiet:true},{subscription:false}]){const {service,calls}=scheduler(options);assert.deepEqual(await service.runReplenishmentReminders(noon),{sent:0});assert.equal(calls.reserved,0);}
});
test("removed collaborators have their personal reminders disabled",async()=>{
 const {service,calls}=scheduler({revoked:true});await service.runReplenishmentReminders(noon);assert.equal(calls.disabled,1);assert.equal(calls.reserved,0);
});
test("cancellation or preference change invalidates a stale scheduler reservation",async()=>{
 const {service}=scheduler({cas:false});assert.deepEqual(await service.runReplenishmentReminders(noon),{sent:0});
});
test("list access is checked before reading personal settings",async()=>{
 const service=new ReplenishmentService({marketList:{findFirst:async()=>null}} as never);
 await assert.rejects(()=>service.get("stranger","list"),/Lista/);
});
test("frequent suggestions count distinct personal purchases and exclude existing items",async()=>{
 const arroz={productName:"Arroz",unit:"un",quantity:1,pricePaid:10};const leite={productName:"Leite",unit:"l",quantity:1,pricePaid:10};
 const service=new ReplenishmentService({marketList:{findFirst:async()=>({items:[arroz]})},listReplenishment:{findUnique:async()=>null},purchase:{findMany:async()=>[{items:[arroz,leite,leite]},{items:[arroz,leite]}]}} as never);
 const suggestions=await service.suggestions("u","l");assert.equal(suggestions.length,1);assert.equal(suggestions[0].productName,"Leite");assert.match(suggestions[0].explanation,/2 das suas últimas 2/);
});
test("suggestion acceptance rejects viewers and preserves existing items on repeated accept",async()=>{
 const item={id:"i",productName:"Leite",unit:"l",quantity:1,pricePaid:10};
 let created=0;
 const tx={$queryRaw:async()=>[],marketList:{findFirst:async()=>({userId:"u",members:[],items:[item]})},marketListItem:{create:async()=>{created++;return item;}}};
 const prisma={marketList:{findFirst:async()=>({items:[]})},listReplenishment:{findUnique:async()=>null},purchase:{findMany:async()=>[{items:[item]},{items:[item]}]},$transaction:async(fn:any)=>fn(tx)};
 const service=new ReplenishmentService(prisma as never);
 const [suggestion]=await service.suggestions("u","l");assert.equal((await service.accept("u","l",suggestion.key)).id,"i");assert.equal(created,0);
 await assert.rejects(()=>service.accept("viewer","l",suggestion.key),/editar esta lista/);
});
test("items with zero price or quantity never become frequent suggestions",async()=>{
 const unpaid={productName:"Nunca comprado",unit:"un",quantity:1,pricePaid:0};
 const zeroQuantity={productName:"Quantidade zero",unit:"un",quantity:0,pricePaid:10};
 const purchased={productName:"Comprado",unit:"un",quantity:1,pricePaid:10};
 const service=new ReplenishmentService({marketList:{findFirst:async()=>({items:[]})},listReplenishment:{findUnique:async()=>null},purchase:{findMany:async()=>[{items:[unpaid,zeroQuantity,purchased]},{items:[unpaid,zeroQuantity,purchased]}]}} as never);
 assert.deepEqual((await service.suggestions("u","l")).map(item=>item.productName),["Comprado"]);
});
