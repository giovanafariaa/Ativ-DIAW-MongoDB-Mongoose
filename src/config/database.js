import mongoose from 'mongoose';
import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

export async function conectarBanco() {
  if (!process.env.MONGODB_URI) 
    throw new Error('Configure MONGODB_URI no arquivo .env');

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  
  console.log('MongoDB Atlas conectado');
}
