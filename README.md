# ZMedia — Multi-Cloud Edge Media Gateway & Dynamic Watermarking CDN

> **Cloudflare Workers Edge CDN, Real-Time Dynamic Watermarking, R2/B2 S3 Proxy & 0MB Google Drive Watermarking**  
> Protects studio intellectual property with on-the-fly watermarking, sub-10ms edge caching, and zero origin server involvement.

[![Version](https://img.shields.io/badge/version-0.9.1-purple.svg?style=for-the-badge)](VERSION.md)
[![Status](https://img.shields.io/badge/status-production-success.svg?style=for-the-badge)](https://media.zorviktech.com)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020.svg?style=for-the-badge&logo=cloudflare)](https://workers.cloudflare.com/)
[![S3 Storage](https://img.shields.io/badge/Cloudflare-R2%20%2F%20B2-blue.svg?style=for-the-badge&logo=amazons3)](https://www.cloudflare.com/products/r2/)
[![Sentry](https://img.shields.io/badge/Sentry-Cloudflare%20Edge-purple.svg?style=for-the-badge&logo=sentry)](https://sentry.io/)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg?style=for-the-badge)](LICENSE)

---

## 🌐 Production Edge Endpoints

- **Canonical Edge CDN**: [https://media.zorviktech.com](https://media.zorviktech.com)
- **Secondary Domain**: [https://zmedia.zorviktech.com](https://zmedia.zorviktech.com)
- **Cloudflare Worker Mirror**: [https://zmedia.workers.dev](https://zmedia.workers.dev)
- **Health Check**: `GET https://media.zorviktech.com/health`

---

## 🌟 Executive Overview

**ZMedia** is a serverless edge media gateway running on Cloudflare Workers. It intercepts client media requests from `ZStudio-Frontend` and public galleries, dynamically validates the tenant's license status and feature tier, fetches protected full-resolution assets from private **Cloudflare R2** or **Backblaze B2** storage buckets, and applies dynamic, un-crop-able watermarks on-the-fly.

Because processing occurs entirely inside Cloudflare's global edge network (utilizing Cloudflare Image Resizing and edge caching), client media delivery achieves sub-10ms latency worldwide while imposing **zero compute load** on origin database and application servers.

### Core Architectural Pillars
- **Zero-Origin Dynamic Watermarking**: Injects client studio logos, copyright notices, and diagonal protection grids on proofing photos in real time.
- **External Google Drive Media Proxy (`/external/`)**: Allows studios to link high-resolution photos hosted in Google Drive (`lh3.googleusercontent.com` / `drive.google.com`), proxying and dynamically watermarking them without consuming any Zorvik cloud storage quota.
- **Private S3 / R2 Signing (`aws4fetch`)**: Accesses private storage buckets via SigV4 signatures; original raw media is never publicly exposed.
- **Edge License Verification**: Validates tenant licensing, domain whitelists, and active subscription status via Supabase REST API cached at the edge.

---

## 🏛️ System Architecture & Edge Request Lifecycle

```mermaid
flowchart TD
    subgraph ClientBrowser["Client & Gallery Visitors"]
        VISITOR["Browser / VIP Proofing Gallery<br/>(Requests Image URL)"]
    end

    subgraph CloudflareEdge["Cloudflare Edge Network (ZMedia Worker)"]
        EDGE_ROUTER["Edge Router & CORS Guard"]
        LICENSE_VAL["Edge License & Origin Validator<br/>(Supabase REST Cache)"]
        SIGV4_FETCH["Private SigV4 S3 Fetcher<br/>(aws4fetch)"]
        GDRIVE_PROXY["External GDrive Proxy Engine<br/>(/external/*)"]
        CF_RESIZING["Cloudflare Image Resizing Engine<br/>(Applies Watermark Overlay)"]
        EDGE_CACHE["Cloudflare Global Edge Cache"]
    end

    subgraph StorageVaults["Media Storage Providers"]
        R2_VAULT["Cloudflare R2 / Backblaze B2<br/>(Private S3 Bucket)"]
        GDRIVE["Google Drive Media Servers<br/>(lh3.googleusercontent.com)"]
    end

    VISITOR --> EDGE_ROUTER
    EDGE_ROUTER --> LICENSE_VAL

    LICENSE_VAL -->|Authorized Origin| EDGE_CACHE
    EDGE_CACHE -.->|Cache Hit (sub-10ms)| VISITOR

    EDGE_CACHE -->|Cache Miss| SIGV4_FETCH
    EDGE_CACHE -->|External URL Miss| GDRIVE_PROXY

    SIGV4_FETCH --> R2_VAULT
    GDRIVE_PROXY --> GDRIVE

    R2_VAULT --> CF_RESIZING
    GDRIVE --> CF_RESIZING

    CF_RESIZING --> EDGE_CACHE
```

---

## 🚀 Key Endpoints & Parameters

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `GET /` | `GET` | Service overview & documentation link. |
| `GET /health` | `GET` | Instant health probe (`{ "status": "ok" }`). |
| `GET /images/*?url=<s3_url>` | `GET` | Fetches private R2/B2 image, validates studio license, and applies watermark. |
| `GET /external/*?url=<gdrive_url>` | `GET` | Fetches and watermarks external Google Drive image (0 MB quota consumed). |
| `OPTIONS *` | `OPTIONS` | Preflight CORS handler returning `204 No Content`. |

### Query Parameters
- `url` (*Required*): Fully-qualified URL of the target asset in Cloudflare R2, Backblaze B2, or Google Drive.
- `watermark` (*Optional*): Boolean override or text watermark string.
- `width` / `height` (*Optional*): Dynamic downscaling constraints to conserve client mobile bandwidth.

---

## 📁 Repository Directory Structure

```
ZMedia/
├── src/
│   ├── config.ts            # Whitelisted domains, Sentry, and bucket settings
│   ├── gdriveProxy.ts       # External Google Drive media proxy handler
│   ├── imageHandler.ts      # Cloudflare Image Resizing & watermarking logic
│   ├── licenseValidator.ts  # Supabase REST license & tenant verification
│   └── index.ts             # Cloudflare Worker entry point
├── test/                    # Vitest integration and unit test suite
├── .env.example             # Documented environment blueprint
├── eslint.config.mjs        # Strict ESLint configuration
├── package.json             # Scripts and dependencies
├── tsconfig.json            # TypeScript configuration
├── wrangler.toml            # Cloudflare Worker configuration & routes
└── VERSION.md               # Version changelog
```

---

## ⚙️ Environment Variables & Cloudflare Secrets

Configure via `wrangler.toml` and `wrangler secret put`:

| Secret / Variable | Required | Description |
| :--- | :--- | :--- |
| `SUPABASE_URL` | Yes | Supabase PostgreSQL project URL for license queries. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase elevated key for authorized tenant lookups. |
| `BUCKET_ACCESS_TOKEN` | Yes | Bearer / SigV4 credentials for private R2/B2 bucket. |
| `SENTRY_DSN` | Optional | Sentry Cloudflare Workers integration DSN. |

---

## 🛠️ Local Development & Quality Runbook

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Cloudflare Wrangler Local Dev
```bash
npm run dev
```
Accessible at `http://localhost:8787`.

### 3. Run Strict Linting (Zero-Warning Policy)
```bash
npm run lint
```

### 4. Automated Test Suite
```bash
npm run test
```

### 5. Deploy to Cloudflare Workers Global Edge
```bash
npm run deploy
```

---

## 👨‍💻 Founder & Architectural Leadership

**ZMedia** is designed, architected, and maintained by:

- **Founder & Lead Architect**: **Vikash Kumar Singh**
- **Email**: [vikash@zorviktech.com](mailto:vikash@zorviktech.com)
- **Phone / WhatsApp**: [+91 8409792083](tel:+918409792083)
- **LinkedIn**: [linkedin.com/in/itsmevikashkumarsingh](https://www.linkedin.com/in/itsmevikashkumarsingh/)
- **GitHub**: [@ItsMeVikashKumarSingh](https://github.com/ItsMeVikashKumarSingh)
- **Website**: [zorviktech.com](https://zorviktech.com)

---

## 📄 License & Intellectual Property

**Copyright © 2026 Zorvik Tech. All Rights Reserved.**

This software and its associated source code, design systems, algorithms, and documentation are the proprietary intellectual property of **Zorvik Tech**. Unauthorized copying, reproduction, distribution, reverse engineering, or commercial use is strictly prohibited without prior written consent.
