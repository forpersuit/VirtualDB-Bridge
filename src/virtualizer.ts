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
