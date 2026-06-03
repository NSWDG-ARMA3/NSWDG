# Supabase login setup

This version does not put the Supabase URL or anon key in browser JavaScript.

Important: this requires Cloudflare Workers / Cloudflare Static Assets. Plain GitHub Pages cannot hide these values because every frontend file is public.

## 1. Supabase

1. Create a Supabase project.
2. Go to Authentication > Providers.
3. Enable Email provider.
4. For testing, you can disable email confirmations. For production, keep confirmations on.

## 2. Cloudflare secrets

Install Wrangler, then from the site folder run:

```bash
npm install wrangler --save-dev
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
```

Use your Supabase project URL and anon/public key when prompted. They will be stored server-side by Cloudflare, not inside your HTML.

## 3. Deploy

```bash
npx wrangler deploy
```

## 4. Pages added

- `/login/` login and test signup page
- `/member/` example member page that checks the HTTP-only session cookie
- `/api/auth/signup` server-side signup endpoint
- `/api/auth/login` server-side login endpoint
- `/api/auth/logout` server-side logout endpoint
- `/api/auth/me` server-side session check endpoint

## Security notes

- Do not put Supabase service role keys in frontend code.
- This setup stores the access token in an HTTP-only cookie.
- Static files under `/member/` are not truly private because static hosting can still serve files directly. Only data returned by `/api/*` is protected. For truly private pages/files, every protected response must be served through the Worker after checking the session.
- The existing Discord webhook in `apply/index.html` was already visible in the ZIP. Rotate it before publishing.
