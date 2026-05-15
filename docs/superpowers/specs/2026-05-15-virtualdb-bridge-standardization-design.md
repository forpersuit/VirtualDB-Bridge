# 2026-05-15 VirtualDB-Bridge Standardization Design

## 1. Project Overview
**VirtualDB-Bridge** is a secure Database & Email Gateway designed for multi-tenant "Virtual Workspace" environments. It provides transparent SQL rewriting to isolate tenants within a shared MySQL/MariaDB instance and offers a Cloudflare Access-protected API for database queries and email delivery.

## 2. Goals
- **Open-Source Ready**: Remove all hardcoded secrets and proprietary information.
- **Modular Architecture**: Separate concerns into reusable modules.
- **Improved Configuration**: Use JSON-based tenant management and environment variables for system secrets.
- **Comprehensive Documentation**: Provide a clear README for a general audience.

## 3. Architecture Changes

### 3.1. Directory Structure (Proposed)
```
/root/apps/db-bridge/
├── .env                  # System secrets (ignored by git)
├── .env.example          # Template for .env
├── tenants.json          # Tenant API Key to Prefix mapping
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript config
├── src/
│   ├── index.ts          # Entry point (Server initialization)
│   ├── virtualizer.ts    # SQL Rewriting logic (extracted from index.ts)
│   ├── config.ts         # Configuration loader (dotenv + tenants.json)
│   ├── db.ts             # Database pool management
│   ├── email.ts          # Email service logic
│   └── types.ts          # Type definitions
└── docs/
    └── ...               # Documentation
```

### 3.2. Configuration Management
- **Environment Variables**:
  - `PORT`: Server port.
  - `CF_TEAM_DOMAIN`: Cloudflare Access team domain.
  - `CF_AUDIENCE_TAG`: Cloudflare Access audience tag.
  - `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`: Main DB connection.
  - `VMAIL_HOST`, `VMAIL_USER`, `VMAIL_PASS`, `VMAIL_NAME`: Email verification DB.
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`: SMTP server credentials.
- **`tenants.json`**:
  ```json
  {
    "sk-tenant-1-key": { "prefix": "t1_", "defaultDb": "t1_data" },
    "sk-tenant-2-key": { "prefix": "t2_", "defaultDb": "t2_data" }
  }
  ```

### 3.3. Module Breakdown
- **Virtualizer**: Pure logic for regex-based SQL rewriting. Supports `CREATE`, `DROP`, `USE`, and `db.table` syntax.
- **Config**: Responsible for loading and validating `.env` and `tenants.json`.
- **DB/Email**: Standardized wrappers around `mysql2` and `nodemailer` using config values.

## 4. Implementation Plan (High Level)
1. **Prepare Environment**: Update `.env.example` and create a dummy `tenants.json`.
2. **Refactor Code**:
   - Extract `SQLVirtualizer` to its own file.
   - Create `config.ts` to handle all configuration loading.
   - Separate DB and Email logic into their own modules.
   - Update `index.ts` to use these modules.
3. **Verification**:
   - Create a test suite to verify SQL rewriting logic.
   - Perform end-to-end tests to ensure existing functionality is preserved.
4. **Documentation**:
   - Write a detailed `README.md` covering architecture, installation, and usage.
   - Update the API guide.

## 5. Security Considerations
- Ensure `.env` and `tenants.json` (if it contains sensitive keys) are properly handled (e.g., added to `.gitignore`).
- All passwords and tokens MUST be removed from source files.
