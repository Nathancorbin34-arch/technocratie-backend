const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../database');
const { envoyerEmailConfirmation } = require('../email');

const router = express.Router();

// Prix officiels — la SEULE source de vérité, jamais le frontend
const PRIX_OFFICIEL = '44,99 €';
const PRIX_OFFICIEL_CENTIMES = 4499;

router.post('/creer-session', async (req, res) => {
  const { items, clientEmail } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Panier vide ou invalide' });
  }

  // Validation stricte de chaque item
  for (const item of items) {
    if (
      typeof item.nom !== 'string' || !item.nom.trim() ||
      typeof item.taille !== 'string' || !item.taille.trim() ||
      !Number.isInteger(item.quantite) || item.quantite <= 0 || item.quantite > 20
    ) {
      return res.status(400).json({ message: 'Panier invalide' });
    }
    if (item.surnom && (typeof item.surnom !== 'string' || item.surnom.length > 20)) {
      return res.status(400).json({ message: 'Surnom invalide' });
    }
    if (item.numero && (typeof item.numero !== 'string' || item.numero.length > 2)) {
      return res.status(400).json({ message: 'Numéro invalide' });
    }
  }

  // Vérification du nombre total de maillots (max 20 par commande)
  const totalQuantite = items.reduce((sum, item) => sum + item.quantite, 0);
  if (totalQuantite > 20) {
    return res.status(400).json({ message: 'Maximum 20 maillots par commande' });
  }

  const param = db.prepare('SELECT valeur FROM parametres WHERE cle = ?').get('commandes_ouvertes');
  if (param && param.valeur === 'false') {
    return res.status(403).json({ message: 'Les commandes ne sont pas ouvertes pour le moment.' });
  }

  const indisponibles = [];
  for (const item of items) {
    const stock = db.prepare('SELECT quantite FROM stocks WHERE produit_nom = ? AND taille = ?').get(item.nom, item.taille);
    const quantiteDisponible = stock ? stock.quantite : 0;
    if (quantiteDisponible < item.quantite) {
      indisponibles.push({ nom: item.nom, taille: item.taille, disponible: quantiteDisponible, demande: item.quantite });
    }
  }

  if (indisponibles.length > 0) {
    return res.status(400).json({ message: 'Certains articles ne sont plus disponibles', indisponibles });
  }

  try {
    // ⚠️ Sécurité : on ignore item.prix venant du client, on impose le prix officiel
    const lineItems = items.map(item => ({
      price_data: {
        currency: 'eur',
        product_data: { name: `${item.nom} - Taille ${item.taille}`, images: [] },
        unit_amount: PRIX_OFFICIEL_CENTIMES,
      },
      quantity: item.quantite,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:4200'}/commande-confirmee?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:4200'}/panier`,
      customer_email: clientEmail || undefined,
      metadata: {
        items: JSON.stringify(items.map(item => ({
          n: item.nom,
          t: item.taille,
          q: item.quantite,
          p: PRIX_OFFICIEL,
          s: item.surnom || '',
          r: item.numero || ''
        }))),
      },
    });

    res.json({ url: session.url });

  } catch (error) {
    console.log('ERREUR Stripe:', error.message);
    res.status(500).json({ message: 'Erreur Stripe', error: error.message });
  }
});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature invalide:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    try {
      const items = JSON.parse(session.metadata.items || '[]');
      const email = session.customer_email || session.customer_details?.email || null;

      let clientId = null;
      if (email) {
        const client = db.prepare('SELECT id FROM clients WHERE email = ?').get(email);
        if (client) clientId = client.id;
      }

      const total = (session.amount_total || 0) / 100;

      const commande = db.prepare(`
        INSERT INTO commandes (client_id, total, statut)
        VALUES (?, ?, 'payee')
      `).run(clientId, total);

      const commandeId = commande.lastInsertRowid;

      const insertProduit = db.prepare(`
        INSERT INTO commande_produits (commande_id, produit_id, quantite, taille, prix_unitaire, surnom, numero)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        const produit = db.prepare('SELECT id FROM produits WHERE nom = ?').get(item.n);
        const produitId = produit ? produit.id : null;
        const prixUnitaire = parseFloat(item.p.replace(',', '.').replace(' €', ''));
        insertProduit.run(commandeId, produitId, item.q, item.t, prixUnitaire, item.s || null, item.r || null);

        db.prepare(`UPDATE stocks SET quantite = MAX(0, quantite - ?) WHERE produit_nom = ? AND taille = ?`)
          .run(item.q, item.n, item.t);
      }

      console.log(`✅ Commande #${commandeId} sauvegardée (${total}€)`);

      if (email) {
        await envoyerEmailConfirmation(email, {
          commandeId,
          total,
          items: items.map(i => ({ nom: i.n, taille: i.t, quantite: i.q, prix: i.p })),
        });
      }

    } catch (err) {
      console.error('Erreur sauvegarde commande:', err.message);
    }
  }

  res.json({ received: true });
});

module.exports = router;