# VirtualDB-Bridge Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize the VirtualDB-Bridge project for open-source release by extracting hardcoded secrets, modularizing the monolithic architecture, and implementing a JSON-based tenant management system.

**Architecture:** We will break `src/index.ts` into smaller, focused modules: `types`, `config`, `virtualizer`, `db`, and `email`. We will introduce `.env` for system secrets and `tenants.json` for tenant-to-prefix mappings. We will also introduce `jest` for unit testing the SQL rewriting logic.

**Tech Stack:** Node.js, Express, TypeScript, MySQL2, Nodemailer, Jest (for testing).

---

### Task 1: Setup Testing Environment and Base Types

**Files:**
- Modify: `package.json`
- Create: `src/types.ts`
- Create: `jest.config.js`

- [ ] **Step 1: Install testing dependencies**

Run: `npm install --save-dev jest ts-jest @types/jest`
Expected: Installation succeeds.

- [ ] **Step 2: Initialize Jest configuration**

```bash
npx ts-jest config:init
```
Expected: `jest.config.js` is created.

- [ ] **Step 3: Update package.json scripts**

Run the following command to update `package.json` (or edit manually):
```bash
npm pkg set scripts.test="jest"
```

- [ ] **Step 4: Create shared types**

Create `src/types.ts`:
```typescript
export interface TenantConfig {
  prefix: string;
  defaultDb: string;
}

export type TenantsMap = Record<string, TenantConfig>;
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json jest.config.js src/types.ts
git commit -m "chore: setup testing and base types"
```

---

### Task 2: Implement Configuration Manager

**Files:**
- Create: `.env.example`
- Create: `tenants.json`
- Create: `src/config.ts`

- [ ] **Step 1: Create template environment file**

Create `.env.example`:
```env
PORT=3002
CF_TEAM_DOMAIN=https://your-team-domain.cloudflareaccess.com
CF_AUDIENCE_TAG=your-application-audience-tag

DB_HOST=127.0.0.1
DB_USER=foreclosure
DB_PASS=your_db_password
DB_NAME=foreclosure_data
DB_CONNECTION_LIMIT=10

VMAIL_HOST=127.0.0.1
VMAIL_USER=vmail
VMAIL_PASS=your_vmail_password
VMAIL_NAME=vmail

SMTP_HOST=127.0.0.1
SMTP_PORT=587
SMTP_USER=t1@301098.xyz
SMTP_PASS=your_smtp_password
```

- [ ] **Step 2: Create local `.env` and `tenants.json` (for dev/testing)**

Create `tenants.json`:
```json
{
  "sk-foreclosure-secure-key-2026": {
    "prefix": "foreclosure_",
    "defaultDb": "foreclosure_data"
  }
}
```

Copy existing secrets to a local `.env` (ensure `.env` is in `.gitignore`, though it usually is).
Run: `cp .env.example .env` and manually fill in the secrets found in the original `src/index.ts`.

- [ ] **Step 3: Write configuration loader**

Create `src/config.ts`:
```typescript
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { TenantsMap } from './types';

dotenv.config();

// Load tenants
let tenants: TenantsMap = {};
try {
  const tenantsPath = path.resolve(process.cwd(), 'tenants.json');
  const tenantsData = fs.readFileSync(tenantsPath, 'utf-8');
  tenants = JSON.parse(tenantsData);
} catch (error) {
  console.warn('Warning: Could not load tenants.json. Proceeding with empty tenants.');
}

export const config = {
  port: process.env.PORT || 3002,
  cfTeamDomain: process.env.CF_TEAM_DOMAIN || '',
  cfAudienceTag: process.env.CF_AUDIENCE_TAG || '',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || '',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
  },
  vmail: {
    host: process.env.VMAIL_HOST || '127.0.0.1',
    user: process.env.VMAIL_USER || 'root',
    password: process.env.VMAIL_PASS || '',
    database: process.env.VMAIL_NAME || '',
  },
  smtp: {
    host: process.env.SMTP_HOST || '127.0.0.1',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASS || '',
  },
  tenants
};
```

- [ ] **Step 4: Commit**

```bash
git add .env.example tenants.json src/config.ts
git commit -m "feat: implement configuration manager"
```

---

### Task 3: Extract and Test SQL Virtualizer

**Files:**
- Create: `src/virtualizer.ts`
- Create: `tests/virtualizer.test.ts`

- [ ] **Step 1: Write failing tests for SQLVirtualizer**

Create `tests/virtualizer.test.ts`:
```typescript
import { SQLVirtualizer } from '../src/virtualizer';

describe('SQLVirtualizer', () => {
  const prefix = 'tenantA_';

  describe('rewrite', () => {
    it('rewrites CREATE DATABASE', () => {
      const sql = 'CREATE DATABASE mydb';
      expect(SQLVirtualizer.rewrite(sql, prefix)).toBe('CREATE DATABASE tenantA_mydb');
    });

    it('rewrites CREATE DATABASE IF NOT EXISTS', () => {
      const sql = 'CREATE DATABASE IF NOT EXISTS mydb';
      expect(SQLVirtualizer.rewrite(sql, prefix)).toBe('CREATE DATABASE IF NOT EXISTS tenantA_mydb');
    });

    it('does not double prefix CREATE DATABASE', () => {
      const sql = 'CREATE DATABASE tenantA_mydb';
      expect(SQLVirtualizer.rewrite(sql, prefix)).toBe('CREATE DATABASE tenantA_mydb');
    });

    it('rewrites USE', () => {
      const sql = 'USE mydb';
      expect(SQLVirtualizer.rewrite(sql, prefix)).toBe('USE tenantA_mydb');
    });

    it('rewrites qualified table names', () => {
      const sql = 'SELECT * FROM mydb.users';
      expect(SQLVirtualizer.rewrite(sql, prefix)).toBe('SELECT * FROM `tenantA_mydb`.`users`');
    });
    
    it('skips system databases in qualified names', () => {
        const sql = 'SELECT * FROM information_schema.tables';
        expect(SQLVirtualizer.rewrite(sql, prefix)).toBe('SELECT * FROM information_schema.tables');
    });
  });

  describe('filterResults', () => {
    it('filters SHOW DATABASES results', () => {
      const results = [{ Database: 'tenantA_mydb1' }, { Database: 'other_db' }];
      const filtered = SQLVirtualizer.filterResults('SHOW DATABASES', results, prefix);
      expect(filtered).toEqual([{ Database: 'mydb1' }]);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/virtualizer.test.ts`
Expected: FAIL with "Cannot find module '../src/virtualizer'"

- [ ] **Step 3: Implement SQLVirtualizer**

Create `src/virtualizer.ts` (extracting the logic from `index.ts`):
```typescript
export class SQLVirtualizer {
  static rewrite(sql: string, prefix: string): string {
    let rewritten = sql;

    // 1. Rewrite CREATE DATABASE [IF NOT EXISTS] db_name
    rewritten = rewritten.replace(/CREATE\s+DATABASE\s+(IF\s+NOT\s+EXISTS\s+)?(\w+)/gi, (match, ifNotExists, dbName) => {
      if (dbName.startsWith(prefix)) return match;
      return `CREATE DATABASE ${ifNotExists || ''}${prefix}${dbName}`;
    });

    // 2. Rewrite DROP DATABASE [IF EXISTS] db_name
    rewritten = rewritten.replace(/DROP\s+DATABASE\s+(IF\s+EXISTS\s+)?(\w+)/gi, (match, ifExists, dbName) => {
      if (dbName.startsWith(prefix)) return match;
      return `DROP DATABASE ${ifExists || ''}${prefix}${dbName}`;
    });

    // 3. Rewrite USE db_name
    rewritten = rewritten.replace(/USE\s+(\w+)/gi, (match, dbName) => {
      if (dbName.startsWith(prefix)) return match;
      return `USE ${prefix}${dbName}`;
    });

    // 4. Qualified table names: db_name.table_name
    rewritten = rewritten.replace(/([`"]?)(\w+)\1\.([`"]?)(\w+)\3/gi, (match, quote1, dbName, quote2, tableName) => {
        if (['information_schema', 'mysql', 'performance_schema', 'sys'].includes(dbName.toLowerCase())) return match;
        if (dbName.startsWith(prefix)) return match;
        return `${quote1 || '`'}${prefix}${dbName}${quote1 || '`'}.${quote2 || '`'}${tableName}${quote2 || '`'}`;
    });

    return rewritten;
  }

  static filterResults(command: string, results: any[], prefix: string): any[] {
    if (command.toUpperCase().startsWith('SHOW DATABASES')) {
      return results
        .map(row => {
          const dbName = row.Database || row.database || Object.values(row)[0] as string;
          if (dbName.startsWith(prefix)) {
            return { Database: dbName.replace(prefix, '') };
          }
          return null;
        })
        .filter(row => row !== null);
    }
    return results;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/virtualizer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/virtualizer.ts tests/virtualizer.test.ts
git commit -m "feat: extract and test SQL virtualizer"
```

---

### Task 4: Extract Database and Email Services

**Files:**
- Create: `src/db.ts`
- Create: `src/email.ts`

- [ ] **Step 1: Implement Database Service**

Create `src/db.ts`:
```typescript
import mysql from 'mysql2/promise';
import { config } from './config';

export const pool = mysql.createPool({
  host: config.db.host,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
});

export const vmailPool = mysql.createPool({
  host: config.vmail.host,
  user: config.vmail.user,
  password: config.vmail.password,
  database: config.vmail.database,
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
});
```

- [ ] **Step 2: Implement Email Service**

Create `src/email.ts`:
```typescript
import nodemailer from 'nodemailer';
import { config } from './config';
import { vmailPool } from './db';

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.password,
  },
  tls: {
    rejectUnauthorized: false
  }
});

export async function sendTenantEmail(to: string | string[], subject: string, html: string, text: string, fromUsername?: string, fromName?: string) {
  let senderEmail = config.smtp.user;
  let senderName = 'Notification Service';

  if (fromUsername) {
    const [rows] = await vmailPool.execute('SELECT username FROM mailbox WHERE username = ? AND active = 1', [fromUsername]);
    if ((rows as any[]).length === 0) {
      throw new Error(`Sender email ${fromUsername} does not exist or is inactive`);
    }
    senderEmail = fromUsername;
  }

  if (fromName) {
    senderName = fromName;
  }

  const info = await transporter.sendMail({
    from: `"${senderName}" <${senderEmail}>`,
    to: Array.isArray(to) ? to.join(',') : to,
    subject: subject,
    text: text,
    html: html,
  });

  return info;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/db.ts src/email.ts
git commit -m "feat: extract database and email services"
```

---

### Task 5: Refactor Main Server

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Refactor `src/index.ts` to use new modules**

Overwrite `src/index.ts` with:
```typescript
import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { config } from './config';
import { pool } from './db';
import { SQLVirtualizer } from './virtualizer';
import { sendTenantEmail } from './email';

const app = express();
app.use(express.json());

const CERTS_URL = `${config.cfTeamDomain}/cdn-cgi/access/certs`;
const client = jwksClient({ jwksUri: CERTS_URL });

function getKey(header: any, callback: any) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) callback(err);
    else callback(null, key?.getPublicKey());
  });
}

const validateCFJWT = (req: Request, res: Response, next: NextFunction) => {
  const token = (req.headers['cf-access-jwt-assertion'] || req.headers['x-cf-assertion'] || req.headers['x-cf-app-aud']) as string;
  if (!token) return res.status(401).json({ error: 'Missing Cloudflare Access JWT' });

  jwt.verify(token, getKey, {
    issuer: config.cfTeamDomain,
    audience: config.cfAudienceTag,
  }, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid JWT' });
    (req as any).user = decoded;
    next();
  });
};

app.post('/query', validateCFJWT, async (req: Request, res: Response) => {
  const { sql, params, apiKey } = req.body;
  const tenant = config.tenants[apiKey];

  if (!tenant) return res.status(403).json({ error: 'Invalid API Key' });
  if (!sql) return res.status(400).json({ error: 'Missing SQL' });

  const rewrittenSQL = SQLVirtualizer.rewrite(sql, tenant.prefix);
  
  try {
    const [rows] = await pool.execute(rewrittenSQL, params || []);
    const finalData = SQLVirtualizer.filterResults(sql, rows as any[], tenant.prefix);
    res.json({ success: true, data: finalData });
  } catch (error: any) {
    res.status(500).json({ error: 'DB Error', details: error.message });
  }
});

app.post('/email/send', validateCFJWT, async (req: Request, res: Response) => {
  const { to, subject, html, text, from, fromName, apiKey } = req.body;
  const tenant = config.tenants[apiKey];

  if (!tenant) return res.status(403).json({ error: 'Invalid API Key' });
  if (!to || !subject || (!html && !text)) {
    return res.status(400).json({ error: 'Missing required email fields (to, subject, html or text)' });
  }

  try {
    const info = await sendTenantEmail(to, subject, html, text, from, fromName);
    res.json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error('[Email Error]', error);
    const status = error.message.includes('Sender email') ? 400 : 500;
    res.status(status).json({ error: 'Email Send Error', details: error.message });
  }
});

app.listen(config.port, () => console.log(`Virtual Workspace DB-Bridge on port ${config.port}`));
```

- [ ] **Step 2: Type checking**

Run: `npx tsc --noEmit`
Expected: Exits with code 0 (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "refactor: use extracted modules in main server"
```
