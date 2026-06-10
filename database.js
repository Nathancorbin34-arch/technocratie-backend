const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'technocratie.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prenom TEXT NOT NULL,
    nom TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    telephone TEXT,
    adresse TEXT,
    code_postal TEXT,
    ville TEXT,
    mot_de_passe TEXT NOT NULL,
    date_inscription DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS produits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    prix REAL NOT NULL,
    description TEXT,
    stock INTEGER DEFAULT 0,
    image_front TEXT,
    image_back TEXT
  );

  CREATE TABLE IF NOT EXISTS commandes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    total REAL NOT NULL,
    statut TEXT DEFAULT 'en_attente',
    date_commande DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id)
  );

  CREATE TABLE IF NOT EXISTS commande_produits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    commande_id INTEGER,
    produit_id INTEGER,
    quantite INTEGER,
    taille TEXT,
    prix_unitaire REAL,
    FOREIGN KEY (commande_id) REFERENCES commandes(id),
    FOREIGN KEY (produit_id) REFERENCES produits(id)
  );
`);

console.log('Base de données initialisée !');

module.exports = db;