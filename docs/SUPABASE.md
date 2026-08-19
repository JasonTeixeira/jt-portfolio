# Supabase Setup for Scope Studio

## Activation

1. Open the [sageideas Supabase project](https://app.supabase.com/projects) SQL editor.
2. Copy the entire contents of `supabase/scope_schema.sql` and paste into the SQL editor.
3. Execute the script.
4. Add two environment variables to the jt-portfolio Vercel project settings:
   - `SUPABASE_URL`: The URL of the sageideas project (e.g., `https://xxx.supabase.co`)
   - `SUPABASE_SERVICE_KEY`: The service_role API key from sageideas (found in **Project Settings → API → Service Role Secret**)
5. Deploy jt-portfolio. Persistence activates on the next build.

## Security Note

The `SUPABASE_SERVICE_KEY` is a **server-only secret** and must never be shipped to the client. It grants full access to the database, bypassing all Row-Level Security policies. Store it only in server-side environment variables (Vercel env, `.env.local` for development, never `.env.local.public`). Client-side code cannot access it. All database writes from the Scope Studio client flow through the Vercel backend, which uses this key server-side to authenticate to Supabase.
