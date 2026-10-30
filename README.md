# Luncheon Dining — GitHub + Vercel + Supabase + Paystack

Production-targeted source package based on the provided Luncheon Dining flyers. Responsive website with food packages (GH₵300), fruit/traditional drinks (quotes required), event catering (advertised GH₵60 per head starting rate), orders, reservations, enquiries, WhatsApp and staff dashboard.

**This package is NOT deployed.** Live database, merchant credentials, and hosting must be connected. Do not collect live payments before testing a full transaction and its webhook.

## Deploy to GitHub and Vercel

1. Create a **private** GitHub repository called `luncheon-dining` and upload the **contents of this folder** (not the outer folder). Do **not** upload `.env`, keys, or customer data.
2. Create a Supabase project (choose a suitable data region). In **SQL Editor**, run the full `supabase-schema.sql` file. This makes three persistent tables: `orders`, `reservations`, and `contacts`, with row-level security enabled and no anonymous policies.
3. In Supabase Project Settings > API, copy the **Project URL** and **service_role key**. The service_role key is secret and MUST only be set as a server-side Vercel environment variable. Never use the public `anon` key for backend privileged access.
4. In Vercel, choose **Add New → Project → Import Git Repository**, select the repository, and set Framework Preset **Other** (this project uses static HTML and Vercel Node API functions; no build command necessary). Set the project root to the folder containing `api`, `public`, and `vercel.json`.
5. In Vercel **Settings → Environment Variables**, set the keys in `.env.example` for Production (and Preview if testing there):
   - `SUPABASE_URL` — Supabase URL
   - `SUPABASE_SERVICE_ROLE_KEY` — backend-only key
   - `ADMIN_TOKEN` — long randomly generated secret, e.g. `openssl rand -hex 32`
   - `PAYSTACK_SECRET_KEY` — Ghana Paystack merchant secret key, **only when ready**
   - `PUBLIC_BASE_URL` — exact public Vercel HTTPS URL, without a trailing slash
6. Deploy, and then redeploy after setting or updating environment variables. Open the public URL and test `/api/menu`, a contact request, a reservation, and the dashboard `/admin.html`.
7. In Paystack dashboard, set the webhook URL to `https://YOUR-DOMAIN/api/paystack-webhook`. Enable eligible payment methods in your Ghana merchant profile. Test a transaction in test mode, then verify order records show `paid` **only after server-side verification**. Use live keys only once your merchant account and operational processes are ready.
8. Add a privacy policy, customer consent notice, refund/cancellation policy, delivery service area and business address before public launch. Enable anti-spam/abuse protection and monitoring. Use the admin dashboard only over HTTPS; its bearer token is stored in the browser input, not a cookie.

## Files

- `public/index.html` — homepage; `public/styles.css` and `public/app.js` — frontend
- `public/admin.html` — staff order/reservation/contact dashboard
- `public/payment.html` — payment return/verification page
- `public/*.webp` — drink images including cup/glass beside fruit/ingredients
- `api/[...path].js` — Vercel serverless endpoints (orders, reservations, contacts, admin, Paystack)
- `supabase-schema.sql` — database creation script
- `.env.example` — configuration names without credentials

## API endpoints

- `GET /api/menu`
- `POST /api/orders`
- `POST /api/reservations`
- `POST /api/contacts`
- `GET /api/payment-status?reference=LD-...`
- `POST /api/paystack-webhook`
- `GET` / `PATCH /api/admin/orders`, `/api/admin/reservations`, `/api/admin/contacts` with header `Authorization: Bearer <ADMIN_TOKEN>`

## Important operational notes

- **Never** enter merchant keys or Supabase service-role keys into website forms, GitHub files, or messages. Set them in Vercel's encrypted environment variable settings.
- Reserving an event creates a **request**, not guaranteed availability. Advertised GH₵60/head is a starting offer, not necessarily a final quote.
- Drinks have *unconfirmed prices*. Mixed drink/food baskets retain the priced food subtotal and require drinks to be quoted separately. Paystack checkout is disabled when unpriced items are in the basket.
- Mobile-money, bank transfer, and pay-on-delivery selections are **requests**, not proof that payment happened. `payment_status` remains pending until verified.
- Production rollout should add rate limiting, bot/abuse protection, scheduled data backups, privacy retention/deletion processes, better authentication (MFA for admin), and automated integration tests before significant traffic.
- Supabase service-role access bypasses RLS; the credentials are used **only in serverless functions**, never in browser scripts.

### Troubleshooting

- Blank dashboard or failed orders: verify Supabase schema and environment variables; check Vercel Function Logs.
- `503` from API: configure Supabase backend secrets and create tables.
- Payment checkout disabled: configure valid Paystack keys, correct merchant market/currency support, customer email, and exact site callback URL.
- GitHub updates deploy automatically after the repository is connected to Vercel.


### Food menu photography
Nine photorealistic **illustrative** food images appear next to the exact names and advertised prices from the supplied flyer. These images are illustrative, not verified photos of Luncheon Dining's actual prepared dishes. Replace `public/<item-id>.webp` with restaurant-approved product photos for accurate product representation.
