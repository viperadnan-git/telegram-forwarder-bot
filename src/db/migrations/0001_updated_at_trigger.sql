-- Shared trigger function: any table with an updated_at column can reuse it.
-- Lives in the database, not the app, so raw SQL bumps the column too.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS routes_set_updated_at ON "routes";
--> statement-breakpoint
CREATE TRIGGER routes_set_updated_at
    BEFORE UPDATE ON "routes"
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
DROP TRIGGER IF EXISTS chats_set_updated_at ON "chats";
--> statement-breakpoint
CREATE TRIGGER chats_set_updated_at
    BEFORE UPDATE ON "chats"
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
