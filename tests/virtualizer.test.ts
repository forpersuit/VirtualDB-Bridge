import { describe, it, expect } from '@jest/globals';
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
