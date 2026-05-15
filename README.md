# VirtualDB-Bridge

> **🌐 交互式文档预览**: [点击访问可视化控制台 & 部署指南](https://forpersuit.github.io/VirtualDB-Bridge/docs/portal/index.html)

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
   git clone <repository-url>
   cd db-bridge
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Setup Configuration:
   ```bash
   cp .env.example .env
   cp tenants.example.json tenants.json
   ```
   Edit `.env` and `tenants.json` with your actual configuration details.

4. Build and Run:
   ```bash
   npm run build
   npm start
   ```

### Configuration Files

#### `.env`
System-level secrets and connection strings. Ensure this file is never committed to version control.
```env
PORT=3002
CF_TEAM_DOMAIN=https://your-team-domain.cloudflareaccess.com
CF_AUDIENCE_TAG=your-application-audience-tag

# Main Database Connection
DB_HOST=127.0.0.1
DB_USER=foreclosure
DB_PASS=your_db_password
DB_NAME=foreclosure_data
DB_CONNECTION_LIMIT=10

# ... see .env.example for SMTP settings
```

#### `tenants.json`
Maps API Keys to tenant prefixes. Can be updated dynamically without restarting the core server (if dynamically loaded).
```json
{
  "sk-your-secret-api-key": {
    "prefix": "tenantA_",
    "defaultDb": "tenantA_data"
  }
}
```

## API Reference

### 1. Execute SQL Query
- **URL**: `/query`
- **Method**: `POST`
- **Headers**: Cloudflare Access tokens required.
- **Body**:
  ```json
  {
    "apiKey": "sk-your-secret-api-key",
    "sql": "CREATE TABLE IF NOT EXISTS users (id INT PRIMARY KEY, name VARCHAR(100))",
    "params": []
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": []
  }
  ```

### 2. Send Email
- **URL**: `/email/send`
- **Method**: `POST`
- **Headers**: Cloudflare Access tokens required.
- **Body**:
  ```json
  {
    "apiKey": "sk-your-secret-api-key",
    "to": "user@example.com",
    "subject": "Hello",
    "text": "This is a test email.",
    "from": "t1@301098.xyz",
    "fromName": "System Alert"
  }
  ```
- **Sender Verification**: The gateway connects to a `vmail` database to verify if the `from` address is active in the `mailbox` table. If it's missing or inactive, the request is rejected with a 400 error.

## Advanced Production Setup

### Database Permissions
To ensure true isolation, use the following SQL pattern to grant access to the gateway user:
```sql
-- Grant access to all databases starting with 'tenant1_'
GRANT ALL PRIVILEGES ON `tenant1\_%`.* TO 'gateway_user'@'%' IDENTIFIED BY 'your_secure_password';
FLUSH PRIVILEGES;
```

### Cloudflare Access
1. Create a **Service Token** in Cloudflare Zero Trust.
2. Add an **Access Application** for your bridge domain.
3. Create a **Policy** that allows the Service Token to access the application.
4. Note the **Audience Tag** and **Team Domain** for your `.env` file.

## Security Best Practices
- **Always use Parameterized Queries**: Do not concatenate variables directly into the `sql` string. Use the `params` array.
- **Keep Secrets Safe**: Use the `.env` file for all passwords and tokens.

## License
ISC
