import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, FloatingActionButton, LoadingState, ProductCard, ScreenContainer, SearchBar } from "../../components";
import { api } from "../../lib/api";
import type { Product } from "../../types";
import { useDebouncedValue } from "../shared";

export function ProductsPage() {
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q);
  const navigate = useNavigate();
  const { data = [], isLoading } = useQuery({ queryKey: ["products", debouncedQ], queryFn: () => api<Product[]>(`/products?q=${encodeURIComponent(debouncedQ)}`) });

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
