const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const paiementRoutes = require('./routes/paiement');
const adminRoutes = require('./routes/admin');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: [
    'http://localhost:4200',
    'https://technocratie-frontend-git-main-technocratie-s-projects.vercel.app',
    'https://technocratie-frontend.vercel.app',
    'https://technocratie-wear.fr',
    'https://www.technocratie-wear.fr'
  ]
}));

// ⚠️ Le webhook DOIT être avant express.json()
app.use('/api/paiement/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Technocratie API en ligne !' });
});

app.use('/api/auth', authRoutes);
app.use('/api/paiement', paiementRoutes);
app.use('/api/admin', adminRoutes);

app.listen(PORT, () => {
  console.log(`Serveur Technocratie démarré sur le port ${PORT}`);
});