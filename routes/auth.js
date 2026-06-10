const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../database');

const router = express.Router();

router.post('/inscription', (req, res) => {
  const { prenom, nom, email, telephone, adresse, code_postal, ville, mot_de_passe } = req.body;
  console.log('Données reçues:', req.body);

  if (!prenom || !nom || !email || !mot_de_passe) {
    return res.status(400).json({ message: 'Champs obligatoires manquants' });
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

module.exports = router;