const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../database');
const { envoyerEmailResetPassword } = require('../email');

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/inscription', (req, res) => {
  const { prenom, nom, email, telephone, adresse, code_postal, ville, mot_de_passe } = req.body;

  if (!prenom || !nom || !email || !mot_de_passe) {
    return res.status(400).json({ message: 'Champs obligatoires manquants' });
  }

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ message: 'Adresse email invalide' });
  }

  if (mot_de_passe.length < 6) {
    return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères' });
  }

  try {
    const clientExistant = db.prepare('SELECT id FROM clients WHERE email = ?').get(email);
    if (clientExistant) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }

    const hash = bcrypt.hashSync(mot_de_passe, 10);

    const result = db.prepare(
      'INSERT INTO clients (prenom, nom, email, telephone, adresse, code_postal, ville, mot_de_passe) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(prenom, nom, email, telephone, adresse, code_postal, ville, hash);

    const token = jwt.sign(
      { id: result.lastInsertRowid, email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Compte créé avec succès !',
      token,
      client: { id: result.lastInsertRowid, prenom, nom, email }
    });

  } catch (error) {
    console.log('ERREUR:', error.message);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.post('/connexion', (req, res) => {
  const { email, mot_de_passe } = req.body;

  if (!email || !mot_de_passe) {
    return res.status(400).json({ message: 'Email et mot de passe requis' });
  }

  try {
    const client = db.prepare('SELECT * FROM clients WHERE email = ?').get(email);
    if (!client) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    const valide = bcrypt.compareSync(mot_de_passe, client.mot_de_passe);
    if (!valide) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    const token = jwt.sign(
      { id: client.id, email: client.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Connexion réussie !',
      token,
      client: { id: client.id, prenom: client.prenom, nom: client.nom, email: client.email }
    });

  } catch (error) {
    console.log('ERREUR:', error.message);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Demander la réinitialisation — envoie un email avec un lien
router.post('/mot-de-passe-oublie', async (req, res) => {
  const { email } = req.body;

  if (!email || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ message: 'Adresse email invalide' });
  }

  try {
    const client = db.prepare('SELECT * FROM clients WHERE email = ?').get(email);

    // Toujours répondre pareil, même si le compte n'existe pas (sécurité anti-énumération)
    if (!client) {
      return res.json({ message: 'Si ce compte existe, un email a été envoyé.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expireDans1h = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    db.prepare('UPDATE clients SET reset_token = ?, reset_token_expire = ? WHERE id = ?')
      .run(resetToken, expireDans1h, client.id);

    const lienReset = `${process.env.FRONTEND_URL || 'http://localhost:4200'}/reinitialiser-mot-de-passe?token=${resetToken}`;

    await envoyerEmailResetPassword(client.email, {
      prenom: client.prenom,
      lienReset
    });

    res.json({ message: 'Si ce compte existe, un email a été envoyé.' });

  } catch (error) {
    console.error('Erreur mot-de-passe-oublie:', error.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Réinitialiser le mot de passe avec le token reçu par email
router.post('/reinitialiser-mot-de-passe', (req, res) => {
  const { token, nouveauMotDePasse } = req.body;

  if (!token || !nouveauMotDePasse) {
    return res.status(400).json({ message: 'Token et nouveau mot de passe requis' });
  }

  if (nouveauMotDePasse.length < 6) {
    return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères' });
  }

  try {
    const client = db.prepare('SELECT * FROM clients WHERE reset_token = ?').get(token);

    if (!client) {
      return res.status(400).json({ message: 'Lien invalide ou expiré' });
    }

    if (!client.reset_token_expire || new Date(client.reset_token_expire) < new Date()) {
      return res.status(400).json({ message: 'Ce lien a expiré, fais une nouvelle demande' });
    }

    const hash = bcrypt.hashSync(nouveauMotDePasse, 10);
    db.prepare('UPDATE clients SET mot_de_passe = ?, reset_token = NULL, reset_token_expire = NULL WHERE id = ?')
      .run(hash, client.id);

    res.json({ message: 'Mot de passe réinitialisé avec succès !' });

  } catch (error) {
    console.error('Erreur reinitialiser-mot-de-passe:', error.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.get('/mes-commandes', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'Non autorisé' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const clientId = decoded.id;

    const commandes = db.prepare(`
      SELECT c.id, c.total, c.statut, c.date_commande
      FROM commandes c
      WHERE c.client_id = ?
      ORDER BY c.date_commande DESC
    `).all(clientId);

    for (const commande of commandes) {
      commande.produits = db.prepare(`
        SELECT cp.quantite, cp.taille, cp.prix_unitaire, p.nom
        FROM commande_produits cp
        LEFT JOIN produits p ON cp.produit_id = p.id
        WHERE cp.commande_id = ?
      `).all(commande.id);
    }

    res.json(commandes);
  } catch (err) {
    res.status(401).json({ message: 'Token invalide' });
  }
});

module.exports = router;