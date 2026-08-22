# Deployment Guide: RevmeAI to Vercel (Custom Subdomain: rev.scalezix.com)

This guide provides instructions to deploy your application to Vercel and bind your custom subdomain **`rev.scalezix.com`**.

---

## 1. Environment Variables Setup on Vercel

When importing your GitHub repository into Vercel, navigate to **Settings -> Environment Variables** and add:

| Environment Variable | Value Example / Instructions |
|---|---|
| `BASE_URL` | `https://rev.scalezix.com` |
| `JWT_SECRET` | A 32+ character random string (e.g. `revmeai-prod-jwt-secret-9988`) |
| `RAZORPAY_KEY_ID` | `rzp_live_...` (Your live Razorpay Key ID) |
| `RAZORPAY_KEY_SECRET` | Your live Razorpay Key Secret |
| `GROQ_API_KEY` | `gsk_...` (Your Groq API key for Llama 3 generation) |
| `DATABASE_URL` | `postgresql://...` (PostgreSQL connection string e.g. Supabase or Neon). *If omitted, fallback JSON store engine handles persistence.* |

---

## 2. Deploying to Vercel

1. Push your repository to GitHub.
2. In Vercel, click **Add New -> Project**.
3. Import your GitHub repository.
4. Set the **Framework Preset** to **Other** (Vercel automatically detects `server.js` and `vercel.json`).
5. Add the Environment Variables above.
6. Click **Deploy**.

---

## 3. Custom Subdomain Configuration (`rev.scalezix.com`)

1. In your Vercel Project Dashboard, go to **Settings -> Domains**.
2. Type `rev.scalezix.com` and click **Add**.
3. Log into your DNS provider for `scalezix.com` (Cloudflare, GoDaddy, Namecheap, etc.).
4. Add the following **CNAME** DNS record:

```text
Type:  CNAME
Name:  rev
Value: cname.vercel-dns.com
TTL:   Auto / 3600
```

5. Once DNS propagates (usually 1-5 minutes), Vercel will automatically provision a free SSL certificate for `https://rev.scalezix.com`.

---

## 4. Razorpay Webhook & Web Domain Whitelist

1. Log in to your **Razorpay Dashboard**.
2. Go to **Settings -> Webhooks**.
3. Add Webhook URL: `https://rev.scalezix.com/api/v1/payments/verify-payment`
4. Enable events: `order.paid`, `payment.authorized`, `payment.captured`.

---

## 5. Built-In Features Verification

- **Public Health Check**: `https://rev.scalezix.com/api/v1/health`
- **Interactive Free Demo**: `https://rev.scalezix.com/` (Public Landing Page Sandbox)
- **Mandatory Payment Paywall**: Automated modal blocking dashboard access until subscription is verified.
- **Subscription Plans**:
  - 1 Month Access: **₹1,000**
  - 6 Months Access: **₹4,000**
  - 12 Months Access: **₹5,000**
