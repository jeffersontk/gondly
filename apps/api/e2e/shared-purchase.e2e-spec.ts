// End-to-end: two real users (owner and guest) shop together on a shared list against a real Postgres and the realtime
// gateway. Requires DATABASE_URL pointing to a disposable database with migrations applied and ALLOW_DEV_LOGIN=true.
// Run with: npm run test:e2e --workspace @gondly/api
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { io, type Socket } from "socket.io-client";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";

type Session = { token: string; userId: string; name: string };
type Item = { id: string; productId?: string | null; productName: string; pricePaid: number | string; claimedByUserId?: string | null };
type Purchase = { id: string; status: string; items: Item[]; participants: Array<{ userId: string; user?: { name: string } }> };

const runId = Date.now().toString(36);
let app: INestApplication;
let baseUrl = "";
const sockets: Socket[] = [];

async function request<T>(session: Session | null, method: string, path: string, body?: unknown, expectedStatus = 0): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : undefined;
  if (expectedStatus) {
    assert.equal(response.status, expectedStatus, `${method} ${path} -> ${response.status} ${text}`);
  } else {
    assert.ok(response.ok, `${method} ${path} -> ${response.status} ${text}`);
  }
  return data as T;
}

async function login(name: string): Promise<Session> {
  const email = `${name.toLowerCase()}-${runId}@e2e.gondly.test`;
  const idToken = `dev:${Buffer.from(JSON.stringify({ email, name })).toString("base64")}`;
  const response = await request<{ accessToken: string; user: { id: string } }>(null, "POST", "/auth/google", { idToken });
  return { token: response.accessToken, userId: response.user.id, name };
}

function connect(session: Session) {
  const socket = io(`${baseUrl}/realtime`, { auth: { token: session.token }, transports: ["websocket"], forceNew: true });
  sockets.push(socket);
  return socket;
}

// Resolves with the first event matching the predicate, failing after a timeout.
function nextEvent<T extends Record<string, unknown>>(socket: Socket, event: string, predicate: (payload: T) => boolean = () => true, timeoutMs = 5_000) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);
    const handler = (payload: T) => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
  });
}

describe("shared list purchase (e2e)", () => {
  before(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    configureApp(app);
    await app.listen(0, "127.0.0.1");
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });

  after(async () => {
    sockets.forEach((socket) => socket.disconnect());
    await app?.close();
  });

  it("owner and guest share one cart, see each other's changes and the guest can finish", async () => {
    const owner = await login("Dona");
    const guest = await login("Convidado");

    // Owner builds a list and shares it; the guest asks for access and the owner approves.
    const list = await request<{ id: string }>(owner, "POST", "/lists", { name: `Compra e2e ${runId}` });
    await request(owner, "POST", `/lists/${list.id}/items`, { productName: "Arroz", unit: "un", expectedQuantity: 1 });
    await request(owner, "POST", `/lists/${list.id}/items`, { productName: "Café", unit: "un", expectedQuantity: 1 });
    const invite = await request<{ inviteToken: string }>(owner, "POST", `/lists/${list.id}/share-link`);
    await request(guest, "POST", `/lists/share-links/${invite.inviteToken}/request`);
    const members = await request<Array<{ id: string; userId: string }>>(owner, "GET", `/lists/${list.id}/members`);
    const guestMember = members.find((member) => member.userId === guest.userId);
    assert.ok(guestMember, "guest access request should be listed");
    await request(owner, "PUT", `/lists/${list.id}/members/${guestMember.id}/approve`);

    // Both start shopping from the list: the guest must join the owner's purchase, not open a parallel one.
    const ownerPurchase = await request<Purchase>(owner, "POST", "/purchases/start", { sourceListId: list.id });
    const guestPurchase = await request<Purchase>(guest, "POST", "/purchases/start", { sourceListId: list.id });
    assert.equal(guestPurchase.id, ownerPurchase.id);
    assert.ok(guestPurchase.participants.some((participant) => participant.userId === guest.userId));

    const ownerSocket = connect(owner);
    const joined = nextEvent(ownerSocket, "joinedPurchase");
    ownerSocket.emit("joinPurchase", { purchaseId: ownerPurchase.id });
    await joined;

    // The guest puts the owner's "Arroz" (owner's productId) in the cart; the owner sees it live, with the guest's name.
    const rice = ownerPurchase.items.find((item) => item.productName === "Arroz")!;
    const ownerSeesRice = nextEvent<{ item: Item; by?: { name?: string } }>(ownerSocket, "purchaseItemUpdated", (payload) => payload.item?.id === rice.id);
    await request(guest, "PUT", `/purchases/${ownerPurchase.id}/items/${rice.id}`, {
      productId: rice.productId,
      productName: "Arroz",
      quantity: 1,
      unit: "un",
      pricePaid: 25.9,
    });
    const riceEvent = await ownerSeesRice;
    assert.equal(Number(riceEvent.item.pricePaid), 25.9);
    assert.equal(riceEvent.by?.name, guest.name);

    // The guest claims "Café"; the owner cannot claim it on top.
    const coffee = ownerPurchase.items.find((item) => item.productName === "Café")!;
    const ownerSeesClaim = nextEvent<{ item: Item; action?: string }>(ownerSocket, "purchaseItemUpdated", (payload) => payload.action === "claimed");
    await request(guest, "PUT", `/purchases/${ownerPurchase.id}/items/${coffee.id}/claim`, { claimed: true });
    assert.equal((await ownerSeesClaim).item.claimedByUserId, guest.userId);
    await request(owner, "PUT", `/purchases/${ownerPurchase.id}/items/${coffee.id}/claim`, { claimed: true }, 409);

    // The guest finishes using a market the owner registered; the owner is told the purchase was completed.
    const market = await request<{ id: string }>(owner, "POST", "/markets", { name: `Mercado e2e ${runId}` });
    const ownerSeesFinish = nextEvent<{ status?: string }>(ownerSocket, "purchaseTotalUpdated", (payload) => payload.status === "completed");
    const finished = await request<Purchase>(guest, "POST", `/purchases/${ownerPurchase.id}/finish`, { marketId: market.id, finalPaidAmount: 25.9 });
    assert.equal(finished.status, "completed");
    await ownerSeesFinish;

    // "Café" never went to the cart: it can become a new list.
    const missing = await request<{ name: string; items: Item[] }>(owner, "POST", `/purchases/${ownerPurchase.id}/missing-as-list`);
    assert.deepEqual(missing.items.map((item) => item.productName), ["Café"]);
  });
});
