import express, { Request, Response, NextFunction } from 'express';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3002;
const TEAM_DOMAIN = process.env.CF_TEAM_DOMAIN;
const CERTS_URL = `${TEAM_DOMAIN}/cdn-cgi/access/certs`;

// Tenant Configuration (In-memory for now, can be moved to DB)
const TENANTS: Record<string, { prefix: string, defaultDb: string }> = {
  [process.env.FORECLOSURE_API_KEY || '']: {
    prefix: 'foreclosure_',
    defaultDb: 'foreclosure_data'
  }
};

const client = jwksClient({ jwksUri: CERTS_URL });

function getKey(header: any, callback: any) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) callback(err);
    else callback(null, key?.getPublicKey());
  });
}

// SQL Rewriter for Virtual Workspace
class SQLVirtualizer {
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
    // Matches "db.table", "db"."table", `db`.`table`
    rewritten = rewritten.replace(/([`"]?)(\w+)\1\.([`"]?)(\w+)\3/gi, (match, quote1, dbName, quote2, tableName) => {
        // Skip common system dbs
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

const validateCFJWT = (req: Request, res: Response, next: NextFunction) => {
  const token = (req.headers['cf-access-jwt-assertion'] || req.headers['x-cf-assertion'] || req.headers['x-cf-app-aud']) as string;
  if (!token) return res.status(401).json({ error: 'Missing Cloudflare Access JWT' });

  jwt.verify(token, getKey, {
    issuer: TEAM_DOMAIN,
    audience: process.env.CF_AUDIENCE_TAG,
  }, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid JWT' });
    (req as any).user = decoded;
    next();
  });
};

const pool = mysql.createPool({
  host: '127.0.0.1',
  user: 'foreclosure',
  password: 'Foreclosure_Secure_2026!',
  database: 'foreclosure_data',
  waitForConnections: true,
  connectionLimit: 10,
});

const vmailPool = mysql.createPool({
  host: '127.0.0.1',
  user: 'vmail',
  password: 'd2onMYW7nB6/BCQ6',
  database: 'vmail',
  waitForConnections: true,
  connectionLimit: 10,
});

app.post('/query', validateCFJWT, async (req: Request, res: Response) => {
  const { sql, params, apiKey } = req.body;
  const tenant = TENANTS[apiKey];

  if (!tenant) return res.status(403).json({ error: 'Invalid API Key' });
  if (!sql) return res.status(400).json({ error: 'Missing SQL' });

  const rewrittenSQL = SQLVirtualizer.rewrite(sql, tenant.prefix);
  console.log(`[Virtualizer] Original: ${sql.substring(0, 50)}...`);
  console.log(`[Virtualizer] Rewritten: ${rewrittenSQL.substring(0, 50)}...`);

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
  const tenant = TENANTS[apiKey];

  if (!tenant) return res.status(403).json({ error: 'Invalid API Key' });
  if (!to || !subject || (!html && !text)) {
    return res.status(400).json({ error: 'Missing required email fields (to, subject, html or text)' });
  }

  let senderEmail = 't1@301098.xyz';
  let senderName = 'Notification Service';

  if (from) {
    try {
      const [rows] = await vmailPool.execute('SELECT username FROM mailbox WHERE username = ? AND active = 1', [from]);
      if ((rows as any[]).length === 0) {
        return res.status(400).json({ error: `Sender email ${from} does not exist or is inactive` });
      }
      senderEmail = from;
    } catch (error: any) {
      console.error('[Email Sender Verify Error]', error);
      return res.status(500).json({ error: 'Failed to verify sender email', details: error.message });
    }
  }

  if (fromName) {
    senderName = fromName;
  }

  try {
    let transporter = nodemailer.createTransport({
      host: '127.0.0.1',
      port: 587,
      secure: false,
      auth: {
        user: 't1@301098.xyz',
        pass: '7F88n(5FFa',
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    let info = await transporter.sendMail({
      from: `"${senderName}" <${senderEmail}>`,
      to: Array.isArray(to) ? to.join(',') : to,
      subject: subject,
      text: text,
      html: html,
    });

    console.log(`[Email] Message sent: ${info.messageId} from ${senderEmail}`);
    res.json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error('[Email Error]', error);
    res.status(500).json({ error: 'Email Send Error', details: error.message });
  }
});

app.listen(PORT, () => console.log(`Virtual Workspace DB-Bridge on port ${PORT}`));
