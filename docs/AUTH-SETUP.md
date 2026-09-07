# Auth setup — one-time Supabase dashboard config

The code for accounts/login/signup/reset is live. Two things must be set **in the
Supabase dashboard** (project: **Sage Ideas Agency**, `hocrntqhgvmeaxwlhzwl`) for the
**email** parts (signup confirmation + password-reset emails) to send from our domain.
Login/signup/dashboard already work without this; email is what needs it.

## 1. URL configuration — Auth → URL Configuration
- **Site URL:** `https://agency.sageideas.dev`
- **Redirect URLs** (add all):
  - `https://agency.sageideas.dev/login.html`
  - `https://agency.sageideas.dev/reset.html`
  - `https://agency.sageideas.dev/dashboard.html`

## 2. Custom SMTP (send auth emails from sageideas.dev) — Auth → Emails → SMTP
Enable custom SMTP and use Resend (domain already verified):
- **Host:** `smtp.resend.com`
- **Port:** `465`
- **Username:** `resend`
- **Password:** your Resend API key (`re_…`)
- **Sender email:** `hello@sageideas.dev`
- **Sender name:** `Jason Teixeira`

## 3. Email confirmation — Auth → Providers → Email
- Keep **Email** provider enabled.
- **Confirm email:** ON (recommended — clients verify their address; the signup page
  already shows a "check your email" state). Turn OFF only if you want instant login
  with no verification.

## Notes
- The browser uses the **public anon key** only; all authorization is server-verified.
- Admin identity is an allowlist: env `ADMIN_EMAILS` (defaults to
  `sage@sageideas.org,hello@sageideas.dev`). Sign up/log in with one of those to be the operator.
- Password reset: the email links back to `/reset.html#type=recovery&access_token=…`,
  which shows the "set a new password" form.
