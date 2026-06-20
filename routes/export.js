const express = require('express');
const PDFDocument = require('pdfkit');
const jwt = require('jsonwebtoken');
const db = require('../database');

const router = express.Router();

const ADMIN_EMAIL = 'jfetsonomerch@gmail.com';

router.get('/commandes-pdf', (req, res) => {
  // Vérification via query param (car window.open ne peut pas envoyer de header)
  const token = req.query.token;
  if (!token) return res.status(401).json({ message: 'Non autorisé' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.email !== ADMIN_EMAIL) {
      return res.status(403).json({ message: 'Accès refusé' });
    }
  } catch (err) {
    return res.status(401).json({ message: 'Token invalide' });
  }

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

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=commandes-technocratie.pdf');
    doc.pipe(res);

    doc.fontSize(20).font('Helvetica-Bold').text('TECHNOCRATIE — RÉCAPITULATIF COMMANDES', { align: 'center' });
    doc.fontSize(9).font('Helvetica').fillColor('#666666').text(`Exporté le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, { align: 'center' });
    doc.moveDown(0.5);

    doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#7a3cff').lineWidth(2).stroke();
    doc.moveDown(1);

    const totalMaillots = commandes.reduce((s, c) => s + (c.produits?.reduce((ss, p) => ss + p.quantite, 0) || 0), 0);
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000')
      .text(`Total commandes : ${commandes.length}   |   Total maillots : ${totalMaillots}`);
    doc.moveDown(1.5);

    for (const commande of commandes) {
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#7a3cff')
        .text(`COMMANDE #${commande.id} — ${new Date(commande.date_commande).toLocaleDateString('fr-FR')} à ${new Date(commande.date_commande).toLocaleTimeString('fr-FR')}`, 40, doc.y, { width: 515 });
      doc.moveDown(0.3);

      const yClient = doc.y;
      doc.rect(40, yClient, 515, commande.adresse ? 52 : 36).fillColor('#f5f5f5').fill();
      doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold')
        .text(`Client : `, 48, yClient + 6, { continued: true })
        .font('Helvetica')
        .text(`${commande.prenom || '—'} ${commande.nom || '—'}`);
      doc.text(`Email : ${commande.email || '—'}   |   Tél : ${commande.telephone || '—'}`, 48, yClient + 18);
      if (commande.adresse) {
        doc.text(`Adresse : ${commande.adresse}, ${commande.code_postal} ${commande.ville}`, 48, yClient + 30);
      }
      doc.moveDown(commande.adresse ? 3.2 : 2.2);

      if (commande.produits && commande.produits.length > 0) {
        const tableTop = doc.y;
        const colMaillot = 40;
        const colTaille = 220;
        const colSurnom = 290;
        const colNumero = 390;
        const colQte = 450;
        const colPrix = 500;

        doc.rect(40, tableTop, 515, 18).fillColor('#333333').fill();
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff');
        doc.text('MAILLOT', colMaillot + 4, tableTop + 5);
        doc.text('TAILLE', colTaille, tableTop + 5);
        doc.text('SURNOM', colSurnom, tableTop + 5);
        doc.text('N°', colNumero, tableTop + 5);
        doc.text('QTÉ', colQte, tableTop + 5);
        doc.text('PRIX', colPrix, tableTop + 5);

        let rowY = tableTop + 18;

        for (let i = 0; i < commande.produits.length; i++) {
          const p = commande.produits[i];
          const bgColor = i % 2 === 0 ? '#ffffff' : '#f9f9f9';
          doc.rect(40, rowY, 515, 16).fillColor(bgColor).fill();
          doc.fontSize(8).font('Helvetica').fillColor('#000000');
          doc.text(p.nom || '—', colMaillot + 4, rowY + 4, { width: 175 });
          doc.text(p.taille || '—', colTaille, rowY + 4);
          doc.text(p.surnom || '—', colSurnom, rowY + 4, { width: 95 });
          doc.text(p.numero || '—', colNumero, rowY + 4);
          doc.text(String(p.quantite), colQte, rowY + 4);
          doc.text(`${p.prix_unitaire} €`, colPrix, rowY + 4);
          rowY += 16;
        }

        doc.rect(40, tableTop, 515, rowY - tableTop).strokeColor('#cccccc').lineWidth(0.5).stroke();
        doc.y = rowY + 10;
      }

      doc.moveDown(1);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#dddddd').lineWidth(0.5).stroke();
      doc.moveDown(1);

      if (doc.y > 680) doc.addPage();
    }

    doc.end();

  } catch (error) {
    console.error('Erreur PDF:', error);
    res.status(500).json({ message: 'Erreur génération PDF' });
  }
});

module.exports = router;