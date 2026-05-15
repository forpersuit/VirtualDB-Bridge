# VirtualDB-Bridge

> **🌐 Interactive Portal**: [Interactive Dashboard & Deployment Guide](https://forpersuit.github.io/VirtualDB-Bridge/docs/portal/index.html)

A secure, multi-tenant "Virtual Workspace" database and email gateway.

VirtualDB-Bridge acts as an API proxy that sits in front of a shared MySQL/MariaDB database. It uses transparent SQL rewriting to isolate tenants. When a tenant executes `CREATE DATABASE mydb`, the gateway automatically rewrites it to `tenantprefix_mydb`, providing the illusion of a dedicated database instance while sharing the same underlying infrastructure.

It also provides an integrated email proxy using Nodemailer, protected by the same tenant isolation and authentication mechanism.

## Features

- **SQL Transparent Virtualization**: Automatic prefixing for `CREATE`, `DROP`, `USE`, and qualified table names.
- **Library-Level Isolation**: Tenants can only see and operate on databases within their prefix. `SHOW DATABASES` is automatically filtered.
- **Double Authentication**: 
  - Edge Gateway Auth: Integrates with Cloudflare Access (requires `CF-Access-Client-Id` / `CF-Access-Client-Secret` and validates JWTs).
  - Business Logic Auth: API Key based tenant identification.
- **Email Proxy**: Send emails securely via API with tenant-specific configuration.
- **Configuration Driven**: Easy management of tenants via `tenants.json` and system secrets via `.env`.

## Architecture

1. **Client** -> Sends JSON payload with SQL/Email data + API Key.
2. **Cloudflare Access** -> Validates the request at the edge, attaches JWT.
3. **VirtualDB-Bridge (Node.js/Express)**:
   - Validates Cloudflare JWT.
   - Looks up tenant prefix using the provided API Key.
   - **Database**: Rewrites the SQL query to include the tenant prefix and forwards it to the database pool.
   - **Email**: Verifies sender domain/mailbox and forwards to the SMTP server.
4. **Database/SMTP Server** -> Executes the operation and returns the result.
5. **VirtualDB-Bridge** -> Filters the results (e.g., stripping prefixes from `SHOW DATABASES`) and returns JSON to the client.

## Getting Started

### Prerequisites

- Node.js (v18+)
- MySQL or MariaDB
- Cloudflare Access (Zero Trust) configured for your domain

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/forpersuit/VirtualDB-Bridge.git
   cd VirtualDB-Bridge
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Setup Configuration:
   ```bash
   cp .env.example .env
   # Add your tenant mappings
   echo '{"sk-your-key": {"prefix": "t1_", "defaultDb": "t1_data"}}' > tenants.json
   ```
   Edit `.env` with your actual infrastructure credentials (DB, SMTP, Cloudflare).

4. Build and Run:
   ```bash
   npm run build
   npm start
   ```

## Security Architecture & Principles

VirtualDB-Bridge is built on the principle of **Defense in Depth** and follows a **Zero Trust** security model.

### 1. The "Double-Gate" Authentication
Every request must pass through two independent authentication layers:
- **Layer 1: Edge Security (Cloudflare Access)**: Only clients with a valid **Service Token** can reach the server. The bridge validates the JWT signature against Cloudflare's public keys.
- **Layer 2: Logic Security (API Key)**: The request body must contain a tenant-specific `apiKey` mapped in `tenants.json`.

### 2. Transparent Data Isolation
The core security feature is **SQL Virtualization**. The bridge:
- Automatically rewrites SQL to enforce tenant prefixes.
- Filters results (like `SHOW DATABASES`) to hide other tenants' metadata.
- Isolation is enforced at the gateway layer, removing the risk of "cross-tenant" data leakage due to developer bugs in the upstream app.

### 3. Database-Level Protection (The Safety Net)
Even if the gateway were compromised, the DB user is restricted via **Wildcard Patterns** (e.g., `GRANT ... ON 'tenantA_%'.*`). The database engine itself will reject any query attempting to access databases outside the authorized prefix.

## Advanced Production Setup

### Database Permissions
Execute this for every tenant prefix to ensure physical isolation:
```sql
GRANT ALL PRIVILEGES ON `tenant1\_%`.* TO 'gateway_user'@'%' IDENTIFIED BY 'secure_password';
FLUSH PRIVILEGES;
```

### Cloudflare Access Setup
1. Create a **Service Token** in Cloudflare Zero Trust.
2. Add a **Self-hosted Application** for your bridge domain.
3. Create a **Policy** (Action: Service Auth) and include the Service Token.
4. Copy the **Audience Tag** from the application overview to your `.env`.

## License
ISC
