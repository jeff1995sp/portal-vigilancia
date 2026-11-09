import crypto from 'crypto';

// Se usar Next.js (Vercel) na pasta pages/api/webhook/easypix.js
// IMPORTANTE: Para ler o body bruto no Next.js (necessário para a assinatura):
export const config = {
  api: {
    bodyParser: false,
  },
};

// Se for Vercel, o firebase-admin precisa ser inicializado
import admin from 'firebase-admin';

// Inicialize o Firebase Admin (Obrigatório para interagir com o Firestore)
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: "site-8dfaf",
            // IMPORTANTE: Preencha clientEmail e privateKey com os dados da sua service account do Firebase!
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL, 
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        })
    });
}
const db = admin.firestore();

// A chave whsec_ gerada na plataforma EasyPix
const EASYPIX_SIGNATURE_KEY = process.env.EASYPIX_SIGNATURE_KEY || 'whsec_sua_chave_aqui'; // COLE SUA CHAVE WHSEC AQUI

// Função auxiliar para ler o raw body no Next.js
async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).send('Método não permitido');
    }

    const signature = req.headers['x-signature'];
    
    if (!signature) {
        return res.status(401).send('Assinatura ausente');
    }

    try {
        const rawBody = await buffer(req);
        
        // 1. Validação da assinatura (HMAC-SHA256)
        const hash = crypto.createHmac('sha256', EASYPIX_SIGNATURE_KEY)
                           .update(rawBody)
                           .digest('hex');

        // Comparação segura
        if (crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature)) === false) {
            console.error("Assinatura de Webhook inválida.");
            return res.status(401).send('Assinatura inválida');
        }

        const payload = JSON.parse(rawBody.toString());
        console.log("Evento EasyPix recebido:", payload.event);

        // 2. Processar Pagamentos Confirmados
        if (payload.event === 'payment_verified') {
            const idempotencyKey = payload.data.idempotencyKey;
            
            if (idempotencyKey) {
                // A chave vem como TAXA_id-do-firebase_timestamp ou MULTA_id-do-firebase_timestamp
                const parts = idempotencyKey.split('_');
                const tipo = parts[0]; 
                const docId = parts[1];

                if (tipo === 'TAXA') {
                    // Libera o Alvará automaticamente
                    await db.collection('pedidos').doc(docId).update({
                        pago: false, 
                        aguardando_alvara: true
                    });
                    console.log(`Taxa processada. ID do processo: ${docId}`);
                } else if (tipo === 'MULTA') {
                    // Dá baixa na Multa
                    await db.collection('multas').doc(docId).update({
                        status: 'Pago'
                    });
                    console.log(`Multa processada. ID da infração: ${docId}`);
                }
            }
        }
        
        // Retorne 200 (recomendação da plataforma para evitar retentativas exponenciais)
        return res.status(200).send('OK');

    } catch (error) {
        console.error("Erro no processamento do Webhook:", error);
        return res.status(500).send('Erro interno do servidor');
    }
}
