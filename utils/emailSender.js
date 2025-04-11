import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export const sendResetCodeEmail = async (email, code) => {
  
  const msg = {
    to: email,
    from: process.env.EMAIL_FROM,
    subject: 'Votre code de réinitialisation',
    text: `Votre code de réinitialisation est : ${code}`,
    html: `
      <h1>Réinitialisation de mot de passe</h1>
      <p>Votre code de vérification est :</p>
      <h2 style="color: #7d3aed;">${code}</h2>
      <p>Ce code expirera dans 1 heure.</p>
    `
  };

  try {
    await sgMail.send(msg);
    console.log('Email de réinitialisation envoyé');
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'email:', error);
    throw new Error('Erreur lors de l\'envoi de l\'email de réinitialisation');
  }
};