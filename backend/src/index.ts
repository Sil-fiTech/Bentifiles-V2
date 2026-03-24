import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import prisma from './prisma';

import authRoutes from './routes/authRoutes';
import usersRoutes from './routes/usersRoutes';
import fileRoutes from './routes/fileRoutes';
import projectRoutes from './routes/projectRoutes';
import documentRoutes from './routes/documentRoutes';
import templateRoutes from './routes/templateRoutes';

import helmet from 'helmet';

dotenv.config();
const app = express();
const port = Number(process.env.PORT) || 4000;

app.use(helmet());

app.use(cors({
    origin: ['https://bentifiles.tech', 'https://www.bentifiles.tech', 'http://localhost:3000', 'http://localhost:3001'],
    methods: 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
    credentials: true
}));
console.log('CORS loaded with PATCH string format');

app.use(express.json());
app.set('trust proxy', 1);

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/templates', templateRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'O backend do BentiFiles está rodando' });
});

const server = app.listen(port, "0.0.0.0", () => {
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
