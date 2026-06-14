const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

async function envoyerEmailConfirmation(destinataire, commande) {
  const { commandeId, total, items } = commande;

  const lignesProduits = items.map(item => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #222;">${item.nom} - Taille ${item.taille}</td>
      <td style="padding: 8px; border-bottom: 1px solid #222; text-align:center;">${item.quantite}</td>
      <td style="padding: 8px; border-bottom: 1px solid #222; text-align:right;">${item.prix}</td>
    </tr>
  `).join('');

  const html = `
    <div style="background:#030305; color:white; font-family:'Arial',sans-serif; padding:2rem; max-width:600px; margin:auto;">
      <h1 style="color:#7a3cff; font-size:2rem; letter-spacing:2px;">TECHNOCRATIE</h1>
      <h2 style="color:white;">Commande confirmée ✓</h2>
      <p style="color:#aaa;">Merci pour ta commande ! Voici le récapitulatif :</p>
      <table style="width:100%; border-collapse:collapse; margin: 1.5rem 0;">
        <thead>
          <tr style="color:#b892ff;">
            <th style="padding:8px; text-align:left;">Produit</th>
            <th style="padding:8px; text-align:center;">Qté</th>
            <th style="padding:8px; text-align:right;">Prix</th>
          </tr>
        </thead>
        <tbody>${lignesProduits}</tbody>
      </table>
      <p style="text-align:right; font-size:1.2rem; color:#7a3cff;"><strong>Total : ${total}€</strong></p>
      <p style="color:#aaa; font-size:0.85rem;">Référence commande : #${commandeId}</p>
      <hr style="border-color:#222; margin: 2rem 0;">
      <p style="color:#555; font-size:0.8rem; text-align:center;">Jf & Sono — Technocratie Merch</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"Technocratie Merch" <${process.env.GMAIL_USER}>`,
    to: destinataire,
    subject: `✓ Commande #${commandeId} confirmée — Technocratie`,
    html,
  });

  console.log(`📧 Email envoyé à ${destinataire}`);
}

async function envoyerEmailSuivi(destinataire, infos) {
  const { prenom, commandeId, numeroSuivi, transporteur } = infos;

  const lienSuivi = transporteur === 'Colissimo' 
    ? `https://www.laposte.fr/outils/suivre-vos-envois?code=${numeroSuivi}`
    : transporteur === 'Chronopost'
    ? `https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=${numeroSuivi}`
    : `https://www.google.com/search?q=${numeroSuivi}`;

  const html = `
    <div style="background:#030305; color:white; font-family:'Arial',sans-serif; padding:2rem; max-width:600px; margin:auto;">
      <h1 style="color:#7a3cff; font-size:2rem; letter-spacing:2px;">TECHNOCRATIE</h1>
      <h2 style="color:white;">Ton colis est en route ! 🚀</h2>
      <p style="color:#aaa;">Salut ${prenom || 'toi'},</p>
      <p style="color:#aaa;">Bonne nouvelle, ta commande <strong style="color:white;">#${commandeId}</strong> a été expédiée !</p>
      <div style="background:rgba(122,60,255,0.15); border:1px solid rgba(122,60,255,0.4); border-radius:8px; padding:1.5rem; margin:1.5rem 0; text-align:center;">
        <p style="color:#b892ff; font-size:0.85rem; margin-bottom:0.5rem;">TON NUMÉRO DE SUIVI</p>
        <p style="color:white; font-size:1.4rem; font-weight:bold; letter-spacing:2px;">${numeroSuivi}</p>
        <p style="color:#aaa; font-size:0.8rem;">Transporteur : ${transporteur}</p>
      </div>
      <a href="${lienSuivi}" style="display:inline-block; padding:1rem 2rem; background:#7a3cff; color:white; text-decoration:none; border-radius:6px; font-weight:bold;">
        Suivre mon colis →
      </a>
      <hr style="border-color:#222; margin: 2rem 0;">
      <p style="color:#555; font-size:0.8rem; text-align:center;">Jf & Sono — Technocratie Merch</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"Technocratie Merch" <${process.env.GMAIL_USER}>`,
    to: destinataire,
    subject: `🚀 Ton colis #${commandeId} est en route !`,
    html,
  });

  console.log(`📧 Email suivi envoyé à ${destinataire}`);
}

module.exports = { envoyerEmailConfirmation, envoyerEmailSuivi };