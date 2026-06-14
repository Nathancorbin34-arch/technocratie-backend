const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const paiementRoutes = require('./routes/paiement');
const adminRoutes = require('./routes/admin');
const stocksRoutes = require('./routes/stocks');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: function(origin, callback) {
    const allowed = [
      'http://localhost:4200',
      'https://technocratie-wear.fr',
      'https://www.technocratie-wear.fr'
    ];
    if (!origin || allowed.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
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
app.use('/api/stocks', stocksRoutes);

app.listen(PORT, () => {
  console.log(`Serveur Technocratie démarré sur le port ${PORT}`);
});