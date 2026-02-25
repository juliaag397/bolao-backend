const { Pool } = require("pg");

const pool = new Pool({
  connectionString: "postgresql://postgres.yzupebeumeysycnczrwr:%40Supabase123@aws-1-us-east-1.pooler.supabase.com:6543/postgres"
});

module.exports = pool;