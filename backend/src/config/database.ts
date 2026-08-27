import { Pool } from 'pg';
import { runtimeConfig } from './runtime';

const pool = new Pool({
  host: runtimeConfig.db.host,
  port: runtimeConfig.db.port,
  database: runtimeConfig.db.name,
  user: runtimeConfig.db.user,
  password: runtimeConfig.db.password,
});

export default pool;
