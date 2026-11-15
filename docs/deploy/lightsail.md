# Aurora on AWS Lightsail (eu-west-1)

**Scope:** Aurora only. Use a **dedicated** Lightsail instance — **never** `ks-ui-app` or other KS hosts.

Production is static files from Vite `dist/` at `/var/www/aurora`, served by Nginx with **HTTPS** (required for Web Bluetooth, PWA install, and wake lock on Android Chrome).

---

## 1. Create the instance (manual — you approve cost)

Region: **eu-west-1 (Ireland)**.

```bash
# Example — run only after you OK the ~$5/mo nano charge:
aws lightsail create-instances \
  --region eu-west-1 \
  --instance-names aurora-poc \
  --availability-zone eu-west-1a \
  --bundle-id nano_3_0 \
  --blueprint-id ubuntu_22_04
```

1. **Attach a static IP** (Lightsail console → Networking → Create static IP → attach to `aurora-poc`).
2. **Open ports** on the instance networking: **HTTP 80**, **HTTPS 443** (and **SSH 22** from your IP only if possible).
3. Note the static IP or hostname for `AURORA_HOST`.

---

## 2. Bootstrap the server (once)

SSH as `ubuntu`:

```bash
ssh ubuntu@<static-ip-or-dns>
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx
sudo mkdir -p /var/www/aurora
sudo chown -R ubuntu:ubuntu /var/www/aurora
```

Copy the example site config from this repo:

```bash
# From your laptop (repo root):
scp scripts/nginx-aurora.conf ubuntu@<host>:/tmp/aurora.conf
ssh ubuntu@<host> 'sudo mv /tmp/aurora.conf /etc/nginx/sites-available/aurora \
  && sudo ln -sf /etc/nginx/sites-available/aurora /etc/nginx/sites-enabled/aurora \
  && sudo rm -f /etc/nginx/sites-enabled/default \
  && sudo nginx -t && sudo systemctl reload nginx'
```

Edit `server_name` in that file **before** reload if you already know the domain.

---

## 3. Domain & TLS

- Point **A record** (or CNAME) at the Lightsail **static IP** (e.g. `aurora.example.com`).
- After DNS propagates:

```bash
sudo certbot --nginx -d aurora.example.com
```

Certbot updates the Nginx server block for HTTPS. Renewals are automatic via `certbot` timer.

**Without a domain:** you can test over **HTTPS on the static IP only** with a self-signed cert (browsers will warn; Bluetooth may still block). Prefer a real domain for phone testing.

---

## 4. Deploy from your laptop

```bash
export AURORA_HOST=ubuntu@<static-ip-or-dns>   # or user@host
./scripts/deploy-lightsail.sh
```

Dry run:

```bash
./scripts/deploy-lightsail.sh --dry-run
```

The script runs `npm run build` and `rsync --delete` into `/var/www/aurora/` on the instance.

---

## 5. Why HTTPS matters

| Feature | Needs secure context |
|--------|----------------------|
| Web Bluetooth (HR strap, GATT `0x180D`) | Yes |
| “Install app” / trusted PWA cues | Yes |
| Wake lock (long sessions) | Yes (typical on mobile) |

Local dev on `http://192.168.x.x:5173` is fine for UI and voice; **strap pairing needs this deploy** (or `vite preview` behind TLS).

---

## 6. Web Bluetooth (stub today)

The app does **not** yet implement the Heart Rate Service. After HTTPS is live, the next step is a small **stub page** or dev flag that:

1. Calls `navigator.bluetooth.requestDevice` with `filters: [{ services: ['heart_rate'] }]`.
2. Surfaces errors clearly (permission denied, no device, non-HTTPS).

Real HR ingestion and IndexedDB → server sync are tracked in GitHub **#7**; deploy scaffolding does not enable BLE by itself.

---

## Checklist

- [ ] Dedicated Lightsail nano in **eu-west-1** (not KS)
- [ ] Static IP attached; **80/443** open
- [ ] Nginx root `/var/www/aurora`
- [ ] Certbot certificate for your domain
- [ ] `AURORA_HOST` set; `./scripts/deploy-lightsail.sh` succeeds
- [ ] Android Chrome over **https://** — install + session smoke test