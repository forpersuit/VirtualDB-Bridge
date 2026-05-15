// Manual Test Script for Virtual Workspace Logic
import { execSync } from 'child_process';

const API_URL = 'http://127.0.0.1:3002/query';
const API_KEY = 'sk-foreclosure-20260429-v1-hei#15In3$0';
const CF_CLIENT_ID = '7b2071f5d4bd9f685fa8911f2bd2b6bc.access';
const CF_CLIENT_SECRET = 'fdcdbc0cb06fc4c151aa56cfbf38460f461a68bc692b59026adb0d732139cbf7';

async function test() {
  console.log('--- Starting Virtual Workspace Tests ---');

  const runQuery = (sql: string) => {
    const cmd = `curl -s -X POST ${API_URL} \
      -H "X-Cf-Assertion: MOCK_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"apiKey": "${API_KEY}", "sql": "${sql}"}'`;
    // Note: This mock test requires disabling JWT check momentarily or using a real token.
    // Since we're on the server, we'll test the Virtualizer logic directly in a unit test.
  };
}

// Unit Test for SQLVirtualizer (No network needed)
class SQLVirtualizer {
  static rewrite(sql: string, prefix: string): string {
    let rewritten = sql;
    rewritten = rewritten.replace(/CREATE\s+DATABASE\s+(IF\s+NOT\s+EXISTS\s+)?(\w+)/gi, (m, i, d) => d.startsWith(prefix) ? m : `CREATE DATABASE ${i || ''}${prefix}${d}`);
    rewritten = rewritten.replace(/DROP\s+DATABASE\s+(IF\s+EXISTS\s+)?(\w+)/gi, (m, i, d) => d.startsWith(prefix) ? m : `DROP DATABASE ${i || ''}${prefix}${d}`);
    rewritten = rewritten.replace(/USE\s+(\w+)/gi, (m, d) => d.startsWith(prefix) ? m : `USE ${prefix}${d}`);
    rewritten = rewritten.replace(/([`"]?)(\w+)\1\.([`"]?)(\w+)\3/gi, (m, q1, d, q2, t) => {
        if (['information_schema', 'mysql', 'performance_schema', 'sys'].includes(d.toLowerCase())) return m;
        return d.startsWith(prefix) ? m : `${q1 || '`'}${prefix}${d}${q1 || '`'}.${q2 || '`'}${t}${q2 || '`'}`;
    });
    return rewritten;
  }
}

const prefix = 'foreclosure_';
const testCases = [
  { input: 'CREATE DATABASE my_app', expected: 'CREATE DATABASE foreclosure_my_app' },
  { input: 'DROP DATABASE IF EXISTS test_db', expected: 'DROP DATABASE IF EXISTS foreclosure_test_db' },
  { input: 'USE my_db', expected: 'USE foreclosure_my_db' },
  { input: 'SELECT * FROM my_db.users', expected: 'SELECT * FROM `foreclosure_my_db`.`users`' },
  { input: 'SELECT * FROM mysql.user', expected: 'SELECT * FROM mysql.user' } // Should NOT prefix system db
];

let failed = false;
testCases.forEach(c => {
  const result = SQLVirtualizer.rewrite(c.input, prefix);
  if (result === c.expected) {
    console.log(`✅ PASS: [${c.input}] -> [${result}]`);
  } else {
    console.log(`❌ FAIL: [${c.input}]`);
    console.log(`   Expected: ${c.expected}`);
    console.log(`   Got:      ${result}`);
    failed = true;
  }
});

if (failed) process.exit(1);
console.log('--- Unit Tests Passed ---');
