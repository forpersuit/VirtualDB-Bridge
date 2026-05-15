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
