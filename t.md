# 🔧 Add Domain to Resend (triagebuilders.com)

Please follow these steps to connect your domain:

---

## 1. Add Domain in Resend

1. Open the Resend Dashboard  
2. Click on **"Add domain"**  
3. Enter your domain:
triagebuilders.com

4. Click **Add**

---

## 2. Configure DNS Records (Important)

After adding the domain, Resend will show DNS records.

You need to:

1. Go to your domain provider (where the domain was purchased — e.g., GoDaddy, Namecheap, Cloudflare)
2. Add **ALL DNS records exactly as shown**, typically:
- SPF record
- DKIM records
- MX record (if provided)

### ⚠️ Important Notes:
- Copy values **exactly** (no extra spaces)
- If an SPF record already exists, **merge it instead of duplicating**
- Do not delete existing important records unless necessary

---

## 3. Verify Domain

1. Go back to Resend
2. Click **Verify domain**
3. Wait until status shows **Verified**

---

## ⏱️ DNS Propagation Time

- Usually takes **5–30 minutes**
- In some cases, it may take **a few hours**

---

## ✅ Done

Once verified, your domain will be ready to send emails.

---

If you need help, I can:
- Check DNS setup for you
- Provide step-by-step instructions for your specific domain provider