const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: 'http://localhost:4200'
}));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Technocratie API en ligne !' });
});

app.use('/api/auth', authRoutes);

app.listen(PORT, () => {
  console.log(`Serveur Technocratie démarré sur le port ${PORT}`);
});