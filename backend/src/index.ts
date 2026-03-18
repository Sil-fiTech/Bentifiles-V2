import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import prisma from './prisma';

import authRoutes from './routes/authRoutes';
import fileRoutes from './routes/fileRoutes';
import projectRoutes from './routes/projectRoutes';
import documentRoutes from './routes/documentRoutes';


import helmet from 'helmet';

dotenv.config();
const app = express();
const port = process.env.PORT || 4000;

app.use(helmet());
app.use(cors({
  origin: ['https://bentifiles.tech', 'https://www.bentifiles.tech'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));
app.use(express.json());


app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/documents', documentRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'O backend do BentiFiles está rodando' });
});

const server = app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

prisma.$connect().then(() => {
    console.log('Connected to database');
}).catch((error) => {
    console.error('Failed to connect to database:', error);
    process.exit(1);
});

// Keep-alive to prevent silent exit in some environments
setInterval(() => { }, 1000 * 60 * 60);
