// Gateway de Pagamento (Node.js) - Integração EasyPix API + Firebase Admin
const express = require('express');
const cors = require('cors');
const axios = require('axios');
// Adicionando o Firebase Admin para alterar o banco de dados de forma segura via backend
const admin = require('firebase-admin');

const app = express();
app.use(cors());
app.use(express.json());

// INICIALIZAR O FIREBASE ADMIN
// É necessário configurar a variável de ambiente FIREBASE_SERVICE_ACCOUNT na Vercel
// contendo o JSON da chave de serviço do seu Firebase (Firebase Console > Project Settings > Service Accounts > Generate new private key)
if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("Firebase Admin inicializado com sucesso.");
    } catch (error) {
        console.error("Erro ao inicializar Firebase Admin. Verifique a variável FIREBASE_SERVICE_ACCOUNT.", error);
    }
}

const db = admin.firestore();

// Chaves da EasyPix
const EASYPIX_API_KEY = process.env.EASYPIX_API_KEY;
const EASYPIX_WEBHOOK_SECRET = process.env.EASYPIX_WEBHOOK_SECRET;

// 1. Rota para GERAR o PIX (Chamada pelo seu site)
app.post('/api/pix', async (req, res) => {
    const { amount, description, payerName, payerDocument, externalReference } = req.body;

    try {
        const response = await axios.post('https://api.easy-pix.com/payments', {
            currency: "BRL",
            amount: Math.round(amount * 100), // Converte para centavos
            idempotencyKey: externalReference || `req_${Date.now()}`,
            method: { type: "qr_code" },
            customer: {
                id: payerDocument ? payerDocument.replace(/\D/g, '') : `cust_${Date.now()}`,
                name: payerName || "Cliente"
            }
        }, {
            headers: {
                'Authorization': `Bearer ${EASYPIX_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        const qrCodeData = response.data.method && response.data.method.qrCode 
                           ? response.data.method.qrCode 
                           : "";

        return res.json({
            success: true,
            copyPaste: qrCodeData,
            paymentId: response.data.id
        });

    } catch (error) {
        console.error("Erro na EasyPix:", error.response ? error.response.data : error.message);
        return res.status(500).json({ success: false, error: 'Erro ao gerar cobrança' });
    }
});

// 2. Rota do WEBHOOK (Para receber confirmação automática e atualizar o Firebase)
app.post('/api/webhook/easypix', express.json(), async (req, res) => {
    const payload = req.body;
    console.log("Webhook Recebido da EasyPix:", payload);
    
    // O ideal em produção é validar a assinatura usando o EASYPIX_WEBHOOK_SECRET aqui
    
    if (payload.event === 'payment_verified') {
        const idPagamento = payload.data.id;
        const valorPago = payload.data.paidAmount;
        // O externalReference que enviamos na criação volta no idempotencyKey ou meta
        const protocoloId = payload.data.idempotencyKey; 
        
        console.log(`Sucesso: Pagamento ${idPagamento} confirmado. Protocolo/ExternalRef: ${protocoloId}`);
        
        if (protocoloId && protocoloId.startsWith('MULTA_')) {
             // Lógica para baixar multas
             const idMulta = protocoloId.replace('MULTA_', '');
             try {
                 await db.collection('multas').doc(idMulta).update({
                     pago: true,
                     dataPagamento: new Date().toISOString()
                 });
                 console.log(`Multa ${idMulta} atualizada para pago.`);
             } catch (e) {
                 console.error(`Erro ao atualizar multa ${idMulta} no Firebase:`, e);
             }
        } else if (protocoloId) {
             // Lógica para baixar taxas/alvarás normais
             try {
                 await db.collection('pedidos').doc(protocoloId).update({
                     pago: true,
                     aguardando_alvara: false,
                     dataPagamento: new Date().toISOString()
                 });
                 console.log(`Pedido ${protocoloId} atualizado para pago.`);
             } catch (e) {
                 console.error(`Erro ao atualizar pedido ${protocoloId} no Firebase:`, e);
             }
        }
    }

    res.status(200).send('OK');
});

module.exports = app;
