import fs from 'fs';
import path from 'path';
import { Op, Sequelize } from 'sequelize';
import { env } from './env';

function createSequelize(): Sequelize {
  if (env.databaseUrl) {
    return new Sequelize(env.databaseUrl, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: env.databaseSsl ? { ssl: { require: true, rejectUnauthorized: false } } : {},
    });
  }
  const storage = env.isTest ? ':memory:' : path.resolve(process.cwd(), env.sqlitePath);
  if (storage !== ':memory:') {
    fs.mkdirSync(path.dirname(storage), { recursive: true });
  }
  return new Sequelize({ dialect: 'sqlite', storage, logging: false });
}

export const sequelize = createSequelize();
export const usingSqlite = sequelize.getDialect() === 'sqlite';
export const dialectName = sequelize.getDialect();

/** Case-insensitive LIKE operator that works on both Postgres and SQLite. */
export const likeOp = usingSqlite ? Op.like : Op.iLike;
