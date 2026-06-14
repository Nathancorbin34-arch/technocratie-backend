const express = require('express');
const db = require('../database');

const router = express.Router();

router.get('/commandes', (req, res) => {
  try {
    const commandes = db.prepare(`
      SELECT c.*, cl.prenom, cl.nom, cl.email, cl.telephone, cl.adresse, cl.code_postal, cl.ville
      FROM commandes c
      LEFT JOIN clients cl ON c.client_id = cl.id
      ORDER BY c.date_commande DESC
    `).all();

    for (const commande of commandes) {
      commande.produits = db.prepare(`
        SELECT cp.quantite, cp.taille, cp.prix_unitaire, cp.surnom, cp.numero, p.nom
        FROM commande_produits cp
        LEFT JOIN produits p ON cp.produit_id = p.id
        WHERE cp.commande_id = ?
      `).all(commande.id);
    }

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

router.get('/parametres', (req, res) => {
  try {
    const param = db.prepare('SELECT valeur FROM parametres WHERE cle = ?').get('commandes_ouvertes');
    res.json({ commandes_ouvertes: param ? param.valeur === 'true' : true });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.put('/parametres/commandes', (req, res) => {
  try {
    const { ouvert } = req.body;
    db.prepare('INSERT OR REPLACE INTO parametres (cle, valeur) VALUES (?, ?)').run('commandes_ouvertes', ouvert ? 'true' : 'false');
    res.json({ success: true, commandes_ouvertes: ouvert });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;