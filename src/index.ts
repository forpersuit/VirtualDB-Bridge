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
