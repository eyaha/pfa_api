import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import authRoutes from './routes/authRoutes.js';
import imageRoutes from "./routes/imageRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import providerConfigRoutes from "./routes/providerConfigRoutes.js";
import imageLogsRoutes from './routes/imageLogs.js';
// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:8000',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use("/api/images", imageRoutes);
app.use("/api/users", userRoutes);
app.use("/api/providers", providerConfigRoutes);
app.use('/api', imageLogsRoutes);
// Database connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Database connected successfully'))
  .catch(err => console.error('❌ Database connection error:', err));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});
app.use((req, res, next) => {
  const error = new Error(`Non trouvé - ${req.originalUrl}`);
  res.status(404);
  next(error);
});

// Basic error handler
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);
  res.json({
    message: err.message,
    // Provide stack trace only in development environment
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
});
export default app;