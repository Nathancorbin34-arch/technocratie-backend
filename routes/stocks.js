const express = require('express');
const db = require('../database');
const router = express.Router();

// Récupérer tous les stocks
router.get('/', (req, res) => {
  const stocks = db.prepare('SELECT * FROM stocks ORDER BY produit_nom, taille').all();
  res.json(stocks);
});

// Récupérer le stock d'un produit/taille spécifique
router.get('/:produit/:taille', (req, res) => {
  const stock = db.prepare('SELECT * FROM stocks WHERE produit_nom = ? AND taille = ?').get(req.params.produit, req.params.taille);
  res.json(stock || { quantite: 0 });
});

// Mettre à jour le stock (admin)
router.put('/:produit/:taille', (req, res) => {
  const { quantite } = req.body;
  db.prepare('INSERT OR REPLACE INTO stocks (produit_nom, taille, quantite) VALUES (?, ?, ?)').run(req.params.produit, req.params.taille, quantite);
  res.json({ success: true });
});

// Vérifier si tous les items du panier sont disponibles
router.post('/verifier', (req, res) => {
  const { items } = req.body;
  const indisponibles = [];

  for (const item of items) {
    const stock = db.prepare('SELECT quantite FROM stocks WHERE produit_nom = ? AND taille = ?').get(item.nom, item.taille);
    const quantiteDisponible = stock ? stock.quantite : 0;
    if (quantiteDisponible < item.quantite) {
      indisponibles.push({
        nom: item.nom,
        taille: item.taille,
        disponible: quantiteDisponible,
        demande: item.quantite
      });
    }
  }

  if (indisponibles.length > 0) {
    return res.status(400).json({ disponible: false, indisponibles });
  }

  res.json({ disponible: true });
});

module.exports = router;