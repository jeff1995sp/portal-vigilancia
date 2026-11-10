// Gateway de Pagamento (Node.js) - Integração EasyPix API
// Este arquivo deve rodar no seu servidor (Firebase Functions, Vercel, Netlify, etc.)

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());

// Chaves da EasyPix (Preferencialmente usar Variáveis de Ambiente)
const EASYPIX_API_KEY = process.env.EASYPIX_API_KEY || 'sk_live_Pwa7cnvDygwDtHR8Pdsamh-4YEGyA603Vx8lrs4JCIM';

// Rota que o seu index_atualizado.html vai chamar para GERAR COBRANÇA
app.post('/api/pix', async (req, res) => {
    const { amount, description, payerName, payerDocument, externalReference } = req.body;

    try {
        const response = await axios.post('https://api.easy-pix.com/payments', {
            currency: "BRL",
            amount: Math.round(amount * 100), // Converte para centavos (ex: 10.00 -> 1000)
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
        
        // Verifica se a resposta contém o QR Code (verifique a documentação exata da sua conta)
        const qrCodeData = response.data.method && response.data.method.qrCode ? response.data.method.qrCode : response.data.id;

        return res.json({
            success: true,
            copyPaste: qrCodeData,
            paymentId: response.data.id
        });

    } catch (error) {
        console.error("Erro no Gateway EasyPix:", error.response ? error.response.data : error.message);
        return res.status(500).json({ success: false, error: 'Erro ao gerar cobrança' });
    }
});

// Opcional: Rota de Webhook para receber confirmações de pagamento da EasyPix
app.post('/api/webhook/easypix', express.json(), (req, res) => {
    const payload = req.body;
    console.log("Webhook Recebido:", payload);
    
    // Verifique o secret do webhook aqui, usando whsec_0f96c90b9a820b85a15bc1486c657fbedd994e90227667967f55169e722f73fa
    
    if (payload.event === 'payment_verified') {
        // Atualize o status no seu banco de dados Firebase
        console.log(`Pagamento ${payload.data.id} confirmado!`);
    }

    res.status(200).send('OK');
});

// A Vercel espera exportar a aplicação
module.exports = app;

// Se for rodar local:
if (require.main === module) {
    app.listen(3000, () => console.log('Novo Gateway rodando na porta 3000'));
}
