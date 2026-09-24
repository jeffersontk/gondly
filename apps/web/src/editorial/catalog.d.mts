import type { Article } from "./types";
export const basePaths: string[];
export function validateArticles(articles: Article[]): void;
export function publishedArticles(articles: Article[]): Article[];
export function publicPaths(articles: Article[]): string[];
export function isEditorialPath(path: string): boolean;
