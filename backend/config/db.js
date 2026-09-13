import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { seedInitialData } from './seedAdmin.js';

dotenv.config();

let isInMemoryDb = false;
let mongoMemoryServerInstance = null;

export const getDbStatus = () => {
  return {
    connected: mongoose.connection.readyState === 1,
    isInMemory: isInMemoryDb,
    host: mongoose.connection.host || 'none',
    readyState: mongoose.connection.readyState,
  };
};

const connectDB = async () => {
  if (process.env.MONGODB_URI) {
    try {
      const conn = await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      isInMemoryDb = false;
      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
      await seedInitialData();
      return conn;
    } catch (error) {
      console.error(`⚠️ Error connecting to configured MongoDB: ${error.message}`);
      console.warn('Falling back to In-Memory MongoDB engine...');
    }
  }

  try {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    mongoMemoryServerInstance = await MongoMemoryServer.create();
    const uri = mongoMemoryServerInstance.getUri();
    const conn = await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    isInMemoryDb = true;
    console.log(`✅ In-Memory MongoDB Engine Started & Connected (${uri})`);
    await seedInitialData();
    return conn;
  } catch (memError) {
    console.error('❌ Failed to initialize database:', memError.message);
  }
};

export default connectDB;
