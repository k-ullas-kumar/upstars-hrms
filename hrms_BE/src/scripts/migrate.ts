import { dialectName, sequelize } from '../config/database';
import '../models'; // registers every model and association before sync

async function main() {
  await sequelize.authenticate();
  // Prefer create-if-missing. Use DB_ALTER=true only when intentionally migrating columns.
  if (process.env.DB_ALTER === 'true') {
    await sequelize.sync({ alter: true });
  } else {
    await sequelize.sync();
  }
  // eslint-disable-next-line no-console
  console.log(`Database schema synchronised (${dialectName}).`);
  await sequelize.close();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Migration failed:', err);
  process.exit(1);
});
