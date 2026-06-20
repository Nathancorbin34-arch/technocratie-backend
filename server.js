// Test persistance volume Railway
const helmet = require('helmet');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const paiementRoutes = require('./routes/paiement');
const adminRoutes = require('./routes/admin');
const stocksRoutes = require('./routes/stocks');
const exportRoutes = require('./routes/export');
const db = require('./database');

const app = express();
app.use(helmet());
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

app.use(express.json({ limit: '1mb' }));

// Rate limit global — 200 requêtes / 15 min par IP
const limiteurGlobal = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { message: 'Trop de requêtes, réessaie plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiteurGlobal);

// Rate limit strict sur connexion/inscription — 10 tentatives / 15 min par IP
const limiteurAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Trop de tentatives de connexion, réessaie dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/connexion', limiteurAuth);
app.use('/api/auth/inscription', limiteurAuth);

app.get('/', (req, res) => {
  res.json({ message: 'Technocratie API en ligne !' });
});

app.use('/api/auth', authRoutes);
app.use('/api/paiement', paiementRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/stocks', stocksRoutes);
app.use('/api/export', exportRoutes);

app.listen(PORT, () => {
  console.log(`Serveur Technocratie démarré sur le port ${PORT}`);
});