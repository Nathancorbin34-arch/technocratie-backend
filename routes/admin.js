const express = require('express');
const db = require('../database');
const { envoyerEmailSuivi } = require('../email');
const adminAuth = require('../middleware/admin-auth');

const router = express.Router();

// ─── ROUTE PUBLIQUE — lue par tous les visiteurs ───
router.get('/parametres', (req, res) => {
  try {
    const paramOuvert = db.prepare('SELECT valeur FROM parametres WHERE cle = ?').get('commandes_ouvertes');
    const paramOuverture = db.prepare('SELECT valeur FROM parametres WHERE cle = ?').get('date_ouverture');
    const paramFermeture = db.prepare('SELECT valeur FROM parametres WHERE cle = ?').get('date_fermeture');

    const dateOuverture = paramOuverture?.valeur || '';
    const dateFermeture = paramFermeture?.valeur || '';

    let commandesOuvertes = paramOuvert ? paramOuvert.valeur === 'true' : true;

    if (dateOuverture && dateFermeture) {
      const maintenant = new Date();
      const ouverture = new Date(dateOuverture);
      const fermeture = new Date(dateFermeture);
      commandesOuvertes = maintenant >= ouverture && maintenant <= fermeture;
      db.prepare('INSERT OR REPLACE INTO parametres (cle, valeur) VALUES (?, ?)').run('commandes_ouvertes', commandesOuvertes ? 'true' : 'false');
    }

    res.json({ commandes_ouvertes: commandesOuvertes, date_ouverture: dateOuverture, date_fermeture: dateFermeture });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ─── À partir d'ici, tout est protégé ───
router.use(adminAuth);

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

router.put('/parametres/dates', (req, res) => {
  try {
    const { date_ouverture, date_fermeture } = req.body;
    db.prepare('INSERT OR REPLACE INTO parametres (cle, valeur) VALUES (?, ?)').run('date_ouverture', date_ouverture || '');
    db.prepare('INSERT OR REPLACE INTO parametres (cle, valeur) VALUES (?, ?)').run('date_fermeture', date_fermeture || '');
    res.json({ success: true });
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

router.post('/commandes/:id/envoyer-suivi', async (req, res) => {
  try {
    const { numeroSuivi, transporteur } = req.body;
    const commandeId = req.params.id;

    const commande = db.prepare(`
      SELECT c.*, cl.prenom, cl.email
      FROM commandes c
      LEFT JOIN clients cl ON c.client_id = cl.id
      WHERE c.id = ?
    `).get(commandeId);

    if (!commande) return res.status(404).json({ message: 'Commande non trouvée' });

    db.prepare('UPDATE commandes SET numero_suivi = ?, statut = ? WHERE id = ?')
      .run(numeroSuivi, 'expediee', commandeId);

    await envoyerEmailSuivi(commande.email, {
      prenom: commande.prenom,
      commandeId,
      numeroSuivi,
      transporteur
    });

    res.json({ success: true });
  } catch (error) {
    console.error('ERREUR envoyer-suivi:', error.message, error.stack);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

module.exports = router;