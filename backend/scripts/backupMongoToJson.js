import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { EJSON } from 'bson';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is not configured; no database connection was attempted.');

const parsedUri = new URL(uri);
const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
const databaseName = decodeURIComponent(parsedUri.pathname.replace(/^\/+/, ''));
if (!['mongodb:', 'mongodb+srv:'].includes(parsedUri.protocol)
  || parsedUri.protocol === 'mongodb+srv:'
  || !localHosts.has(parsedUri.hostname)
  || databaseName !== 'ai_inventory_system') {
  throw new Error('Backup refused: MONGODB_URI must target local ai_inventory_system; its value is not displayed.');
}

const outputDirectory = path.resolve(process.cwd(), 'backup_before_cleanup');
if (existsSync(outputDirectory)) {
  throw new Error(`Backup refused because the destination already exists: ${outputDirectory}`);
}

const run = async () => {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    const database = mongoose.connection.db;
    const collections = await database.listCollections({}, { nameOnly: true }).toArray();
    await mkdir(outputDirectory);

    const manifest = {
      database: databaseName,
      createdAt: new Date().toISOString(),
      format: 'MongoDB Extended JSON (canonical)',
      collections: [],
    };

    for (const { name } of collections) {
      const documents = await database.collection(name).find({}).toArray();
      const file = `${name.replace(/[^A-Za-z0-9_.-]/g, '_')}.json`;
      await writeFile(path.join(outputDirectory, file), `${EJSON.stringify(documents, null, 2, { relaxed: false })}\n`, { flag: 'wx' });
      manifest.collections.push({ name, file, documentCount: documents.length });
      console.log(`${name}: ${documents.length} documents -> ${file}`);
    }

    await writeFile(
      path.join(outputDirectory, 'manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
      { flag: 'wx' },
    );
    console.log(`Backup complete: ${outputDirectory}`);
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error(`JSON backup failed: ${error.message}`);
  process.exitCode = 1;
});
