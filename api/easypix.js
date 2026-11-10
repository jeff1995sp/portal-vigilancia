import crypto from 'crypto';

export const config = {
  api: {
    bodyParser: false,
  },
};

import admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: "site-8dfaf",
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL, 
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        })
    });
}
const db = admin.firestore();

const EASYPIX_SIGNATURE_KEY = process.env.EASYPIX_SIGNATURE_KEY; 

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Método não permitido');

    const signature = req.headers['x-signature'];
    if (!signature) return res.status(401).send('Assinatura ausente');

    try {
        const rawBody = await buffer(req);
        
        const hash = crypto.createHmac('sha256', EASYPIX_SIGNATURE_KEY)
                           .update(rawBody)
                           .digest('hex');

        if (crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature)) === false) {
            console.error("Assinatura de Webhook inválida.");
            return res.status(401).send('Assinatura inválida');
        }

        const payload = JSON.parse(rawBody.toString());

        if (payload.event === 'payment_verified') {
            const idempotencyKey = payload.data.idempotencyKey;
            
            if (idempotencyKey) {
                const parts = idempotencyKey.split('_');
                const tipo = parts[0]; 
                const docId = parts[1];

                if (tipo === 'TAXA') {
                    await db.collection('pedidos').doc(docId).update({
                        pago: false, 
                        aguardando_alvara: true
                    });
                } else if (tipo === 'MULTA') {
                    await db.collection('multas').doc(docId).update({
                        status: 'Pago'
                    });
                }
            }
        }
        
        return res.status(200).send('OK');

    } catch (error) {
        console.error("Erro no Webhook:", error);
        return res.status(500).send('Erro interno');
    }
}
