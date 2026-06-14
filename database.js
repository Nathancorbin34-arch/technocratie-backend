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
    surnom TEXT,
    numero TEXT,
    FOREIGN KEY (commande_id) REFERENCES commandes(id),
    FOREIGN KEY (produit_id) REFERENCES produits(id)
  );

  CREATE TABLE IF NOT EXISTS stocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    produit_nom TEXT NOT NULL,
    taille TEXT NOT NULL,
    quantite INTEGER DEFAULT 0,
    UNIQUE(produit_nom, taille)
  );

  CREATE TABLE IF NOT EXISTS parametres (
    cle TEXT PRIMARY KEY,
    valeur TEXT NOT NULL
  );
`);

// Ajouter les colonnes surnom/numero si elles n'existent pas encore
try {
  db.exec('ALTER TABLE commande_produits ADD COLUMN surnom TEXT');
} catch (e) {}
try {
  db.exec('ALTER TABLE commande_produits ADD COLUMN numero TEXT');
} catch (e) {}

// Initialiser les produits si vides
const produitsExistants = db.prepare('SELECT COUNT(*) as count FROM produits').get();
if (produitsExistants.count === 0) {
  const insertProduit = db.prepare('INSERT OR IGNORE INTO produits (nom, prix) VALUES (?, ?)');
  insertProduit.run('Maillot Technocratie', 44.99);
  insertProduit.run('Rawcratie', 44.99);
  insertProduit.run('Uptempocratie', 44.99);
  insertProduit.run('Zaagocratie', 44.99);
}

// Initialiser les stocks si vides
const stocksExistants = db.prepare('SELECT COUNT(*) as count FROM stocks').get();
if (stocksExistants.count === 0) {
  const produits = ['Maillot Technocratie', 'Rawcratie', 'Uptempocratie', 'Zaagocratie'];
  const tailles = ['XS', 'S', 'M', 'L', 'XL'];
  const insertStock = db.prepare('INSERT OR IGNORE INTO stocks (produit_nom, taille, quantite) VALUES (?, ?, 0)');
  for (const produit of produits) {
    for (const taille of tailles) {
      insertStock.run(produit, taille);
    }
  }
}

// Initialiser les paramètres si vides
db.prepare('INSERT OR IGNORE INTO parametres (cle, valeur) VALUES (?, ?)').run('commandes_ouvertes', 'true');

console.log('Base de données initialisée !');

module.exports = db;