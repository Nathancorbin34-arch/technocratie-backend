const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../database');
const { envoyerEmailConfirmation } = require('../email');

const router = express.Router();

router.post('/creer-session', async (req, res) => {
  const { items, personnalisations, clientEmail } = req.body;

  // Vérifier si les commandes sont ouvertes
  const param = db.prepare('SELECT valeur FROM parametres WHERE cle = ?').get('commandes_ouvertes');
  if (param && param.valeur === 'false') {
    return res.status(403).json({ message: 'Les commandes ne sont pas ouvertes pour le moment.' });
  }

  if (!items || items.length === 0) {
    return res.status(400).json({ message: 'Panier vide' });
  }

  // Vérifier les stocks avant de créer la session
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
    return res.status(400).json({
      message: 'Certains articles ne sont plus disponibles',
      indisponibles
    });
  }

  try {
    const lineItems = items.map(item => ({
      price_data: {
        currency: 'eur',
        product_data: {
          name: `${item.nom} - Taille ${item.taille}`,
          images: [],
        },
        unit_amount: Math.round(
          parseFloat(item.prix.replace(',', '.').replace(' €', '')) * 100
        ),
      },
      quantity: item.quantite,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: 'https://technocratie-wear.fr/commande-confirmee?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://technocratie-wear.fr/panier',
      customer_email: clientEmail || undefined,
      metadata: {
        items: JSON.stringify(items),
        personnalisations: JSON.stringify(personnalisations || []),
      },
    });

    res.json({ url: session.url });

  } catch (error) {
    console.log('ERREUR Stripe:', error.message);
    res.status(500).json({ message: 'Erreur Stripe', error: error.message });
  }
});

// Webhook Stripe
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
        INSERT INTO commande_produits (commande_id, produit_id, quantite, taille, prix_unitaire)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        const produit = db.prepare('SELECT id FROM produits WHERE nom = ?').get(item.nom);
        const produitId = produit ? produit.id : null;
        const prixUnitaire = parseFloat(item.prix.replace(',', '.').replace(' €', ''));
        insertProduit.run(commandeId, produitId, item.quantite, item.taille, prixUnitaire);

        db.prepare(`
          UPDATE stocks SET quantite = MAX(0, quantite - ?)
          WHERE produit_nom = ? AND taille = ?
        `).run(item.quantite, item.nom, item.taille);
      }

      console.log(`✅ Commande #${commandeId} sauvegardée (${total}€)`);

      if (email) {
        await envoyerEmailConfirmation(email, {
          commandeId,
          total,
          items,
        });
      }

    } catch (err) {
      console.error('Erreur sauvegarde commande:', err.message);
    }
  }

  res.json({ received: true });
});

module.exports = router;