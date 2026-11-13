import "reflect-metadata";
import assert from "node:assert/strict";
import { it } from "node:test";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { NestFactory } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { PrismaService } from "../src/prisma/prisma.service";
it("community recipes require explicit publication, render anonymously, escape content and withdraw immediately", async () => {
  const url = new URL(process.env.DATABASE_URL ?? "http://missing");
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname) && url.port === "15432");
  const app = await NestFactory.create(AppModule, { logger: false }); configureApp(app); await app.listen(0,"127.0.0.1");
  const prisma = app.get(PrismaService), users: string[] = [], recipeIds: string[] = [];
  const suffix = randomUUID();
  const origin = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  try {
    const tokens: string[] = [];
    for (let i=0;i<2;i++) { const user = await prisma.user.create({data:{name:"Autor público",email:`public-${i}-${suffix}@example.invalid`}}); users.push(user.id); tokens.push(app.get(JwtService).sign({sub:user.id,email:user.email,name:user.name})); }
    const request = (i: number, path: string, body: unknown) => fetch(origin+path,{method:"POST",headers:{Authorization:`Bearer ${tokens[i]}`,"Content-Type":"application/json"},body:JSON.stringify(body)});
    const create = async (publish: boolean) => { const response = await request(0,"/recipes",{title:`Teste ${suffix} <script>alert(1)</script>`,description:"Receita própria para testar a publicação.",servings:2,prepMinutes:10,cookMinutes:20,ingredients:[{name:`Ingrediente ${suffix}`,quantity:100,unit:"g"}],steps:["Misture os ingredientes.","Cozinhe e sirva."],publish}); assert.equal(response.status,201,await response.clone().text()); const data = await response.json() as {id:string}; recipeIds.push(data.id); return prisma.recipe.findUniqueOrThrow({where:{id:data.id}}); };
    const privateRecipe = await create(false);
    assert.equal((await request(0,`/recipes/${privateRecipe.id}/publication`,{publish:"false"})).status,400);
    assert.equal((await fetch(`${origin}/public-recipe-pages/${privateRecipe.slug}`)).status,404);
    assert.equal((await request(1,`/recipes/${privateRecipe.id}/publication`,{publish:true})).status,404);
    assert.equal((await request(0,`/recipes/${privateRecipe.id}/publication`,{publish:true})).status,201);
    const published = await create(true);
    assert.equal(published.reviewedBy,null,"Publishing is not editorial approval");
    const page = await fetch(`${origin}/public-recipe-pages/${published.slug}`); assert.equal(page.status,200);
    const html = await page.text();
    assert.ok(html.includes("Autor público")); assert.ok(html.includes("Misture os ingredientes."));
    assert.ok(html.includes('application/ld+json')); assert.ok(html.includes('rel="canonical"'));
    const schema = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);
    assert.equal(schema.name,published.title,"Escaped JSON-LD retains the real title");
    assert.equal(schema.image,undefined,"Do not invent a recipe photo");
    assert.ok(!html.includes("<script>alert(1)</script>")); assert.ok(!html.includes("@example.invalid"));
    assert.equal(page.headers.get("cache-control"),"no-store");
    const sitemap = await (await fetch(origin+"/public-recipe-pages/sitemap.xml")).text(); assert.ok(sitemap.includes(published.slug));
    assert.equal((await request(0,`/recipes/${published.id}/publication`,{publish:false})).status,201);
    assert.equal((await fetch(`${origin}/public-recipe-pages/${published.slug}`)).status,404);
    assert.ok(!(await (await fetch(origin+"/public-recipe-pages/sitemap.xml")).text()).includes(published.slug));
  } finally { await prisma.recipe.deleteMany({where:{id:{in:recipeIds}}}); await prisma.user.deleteMany({where:{id:{in:users}}}); await prisma.ingredient.deleteMany({where:{name:`Ingrediente ${suffix}`}}); await app.close(); }
});
