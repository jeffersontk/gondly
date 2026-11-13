-- User-authored recipes may be published by their owner without claiming editorial review.
-- Editorial/imported catalog entries retain their existing review requirements.
ALTER TABLE "Recipe" DROP CONSTRAINT "Recipe_publication_check";
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_publication_check" CHECK (
  ("visibility" <> 'public' OR "status" = 'published') AND
  ("status" <> 'published' OR ("publishedAt" IS NOT NULL AND
    ("origin" = 'user_created' OR ("reviewedAt" IS NOT NULL AND "reviewedBy" IS NOT NULL AND length(trim("reviewedBy")) > 0)))) AND
  ("visibility" <> 'unlisted' OR "shareToken" IS NOT NULL)
);
