-- Preserve the original rule for unlisted recipes as well as public recipes.
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_visible_status_check"
CHECK ("visibility" = 'private' OR "status" = 'published');
