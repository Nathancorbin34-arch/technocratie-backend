const express = require('express');
const db = require('../database');

const router = express.Router();

router.get('/commandes', (req, res) => {
  try {
    const commandes = db.prepare(`
      SELECT c.*, cl.prenom, cl.nom, cl.email
      FROM commandes c
      LEFT JOIN clients cl ON c.client_id = cl.id
      ORDER BY c.date_commande DESC
    `).all();
    res.json(commandes);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.get('/clients', (req, res) => {
  try {
    const clients = db.prepare(`
      SELECT id, prenom, nom, email, telephone, ville, date_inscription
      FROM clients
      ORDER BY date_inscription DESC
    `).all();
    res.json(clients);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.get('/stats', (req, res) => {
  try {
    const totalCommandes = db.prepare('SELECT COUNT(*) as count FROM commandes').get().count;
    const totalClients = db.prepare('SELECT COUNT(*) as count FROM clients').get().count;
    const chiffreAffaires = db.prepare('SELECT SUM(total) as total FROM commandes').get().total || 0;
    const maillotsVendus = db.prepare('SELECT SUM(quantite) as total FROM commande_produits').get().total || 0;

    res.json({
      totalCommandes,
      totalClients,
      chiffreAffaires,
      maillotsVendus
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

module.exports = router;