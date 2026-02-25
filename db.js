const { Pool } = require("pg");

const pool = new Pool({
  connectionString: "postgresql://postgres:%40BolaoCopa123@db.yzupebeumeysycnczrwr.supabase.co:5432/postgres"
});

module.exports = pool;