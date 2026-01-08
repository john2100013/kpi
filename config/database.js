import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Handle database name with or without quotes
let dbName = process.env.DB_NAME || 'kpi_management';
dbName = dbName.replace(/^["']|["']$/g, '');

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: dbName,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
};

// Create a new pool instance
export const createPool = () => new Pool(config);

// Export config for use in scripts
export const dbConfig = config;

export default config;
