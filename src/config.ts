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
