const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../database');

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