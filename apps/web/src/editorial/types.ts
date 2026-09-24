export type Section = {
  title: string;
  paragraphs?: string[];
  items?: string[];
};
export type Article = {
  slug: string;
  title: string;
  summary: string;
  category: string;
  status: "draft" | "published";
  author?: string;
  reviewedBy?: string;
  publishedAt?: string;
  updatedAt?: string;
  sections: Section[];
  recipe?: { yield: string; ingredients: string[]; steps: string[] };
};
