import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    console.warn('⚠️ MONGODB_URI is not configured in environment. Database features will be limited.');
    return;
  }
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`⚠️ Error connecting to MongoDB: ${error.message}`);
    console.warn('Server will continue running with degraded database features.');
  }
};

export default connectDB;
