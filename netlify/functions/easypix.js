const crypto = require('crypto');
const admin = require('firebase-admin');

// Inicialização segura do Firebase em ambiente Serverless
if (!admin.apps.length) {
    if(process.env.FIREBASE_PRIVATE_KEY) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: "site-8dfaf",
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                // Trata as quebras de linha essenciais para chaves RSA no Unix/Netlify
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            })
        });
    }
}

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod === 'GET') {
        return { statusCode: 200, headers, body: JSON.stringify({ status: "Webhook EasyPix Online" }) };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método não permitido' }) };
    }

    const signature = event.headers['x-signature'] || event.headers['X-Signature'];
    if (!signature) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Assinatura ausente' }) };
    }

    try {
        const rawBody = event.body;
        // Chave oficial do webhook EasyPix
        const EASYPIX_SIGNATURE_KEY = "whsec_0f96c90b9a820b85a15bc1486c657fbedd994e90227667967f55169e722f73fa";

        const hash = crypto.createHmac('sha256', EASYPIX_SIGNATURE_KEY)
                           .update(rawBody)
                           .digest('hex');

        if (hash !== signature) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Assinatura inválida' }) };
        }

        const payload = JSON.parse(rawBody);
        const db = admin.apps.length ? admin.firestore() : null;

        if (payload.event === 'payment_verified') {
            const idempotencyKey = payload.data && payload.data.idempotencyKey;

            if (idempotencyKey && db) {
                const parts = idempotencyKey.split('_');
                const tipo = parts[0]; 
                const docId = parts[1];

                if (tipo === 'TAXA' && docId) {
                    await db.collection('pedidos').doc(docId).update({
                        pago: false, 
                        aguardando_alvara: true 
                    });
                } else if (tipo === 'MULTA' && docId) {
                    await db.collection('multas').doc(docId).update({
                        status: 'Pago' 
                    });
                }
            } else if (idempotencyKey && !db) {
                // Se o Firebase não estiver inicializado (variáveis de ambiente faltando), 
                // tenta via REST API como fallback (exige API_KEY)
                const parts = idempotencyKey.split('_');
                const tipo = parts[0]; 
                const docId = parts[1];
                const firebaseApiKey = "AIzaSyDm4YNEuPxXKQm5g_yPinNIcNNneLVf1Rg";
                
                if (tipo === 'TAXA' && docId) {
                    const firebaseUrl = `https://firestore.googleapis.com/v1/projects/site-8dfaf/databases/(default)/documents/pedidos/${docId}?updateMask.fieldPaths=aguardando_alvara&updateMask.fieldPaths=pago&key=${firebaseApiKey}`;
                    await fetch(firebaseUrl, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            fields: {
                                aguardando_alvara: { booleanValue: true },
                                pago: { booleanValue: false }
                            }
                        })
                    });
                } else if (tipo === 'MULTA' && docId) {
                    const firebaseUrl = `https://firestore.googleapis.com/v1/projects/site-8dfaf/databases/(default)/documents/multas/${docId}?updateMask.fieldPaths=status&key=${firebaseApiKey}`;
                    await fetch(firebaseUrl, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            fields: {
                                status: { stringValue: 'Pago' }
                            }
                        })
                    });
                }
            }
        }

        return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'OK' }) };
    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Falha no processamento' }) };
    }
};
