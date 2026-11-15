const fetch = require('node-fetch');
const crypto = require('crypto');

module.exports = async function(req, res) {
    // Configuração de CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Idempotency-Key');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

    try {
        let body = req.body || {};
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ success: false, error: 'JSON inválido.' }); }
        }
        
        const amount = parseFloat(body.amount) || 0;
        const payerName = body.payerName || "Contribuinte";
        let rawDoc = body.payerDocument ? body.payerDocument.replace(/\D/g, '') : '00000000000';
        if (rawDoc.length === 0) rawDoc = '00000000000';
        
        const docType = rawDoc.length === 14 ? 'CNPJ' : 'CPF';
        const externalReference = body.externalReference || 'ref';
        
        // CHAVE SELETORA: define qual API usar
        // Na Vercel, crie a variável GATEWAY_ATIVO com 'alurapay' ou 'elitepay'
        // Se não existir, por padrão usa 'elitepay' (pois você está migrando)
        const gateway = process.env.GATEWAY_ATIVO || 'elitepay'; 

        if (gateway === 'elitepay') {
            const clientId = process.env.ELITEPAY_CLIENT_ID;
            const clientSecret = process.env.ELITEPAY_CLIENT_SECRET;

            if (!clientId || !clientSecret) {
                console.error("ERRO: Credenciais da Elite Pay não encontradas no Vercel.");
                return res.status(500).json({ success: false, error: 'Credenciais Elite Pay ausentes.' });
            }

            const payload = {
                amount: amount,
                description: "Taxa de Alvará Provisório",
                payerName: payerName,
                payerDocument: rawDoc,
                externalReference: externalReference, // Amarra com o Firebase
                projectWebhook: `https://${req.headers.host}/api/webhook-elite`
            };

            const response = await fetch('https://api.elitepaybr.com/api/v1/deposit', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'x-client-id': clientId,
                    'x-client-secret': clientSecret
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            
            if (response.ok && data.success && data.copyPaste) {
                return res.status(200).json({ 
                    success: true, 
                    copyPaste: data.copyPaste, 
                    qrcodeUrl: data.qrcodeUrl,
                    paymentId: data.transactionId,
                    externalId: externalReference
                });
            } else {
                console.error("Erro na Elite Pay:", data);
                return res.status(502).json({ success: false, error: 'Falha no Gateway Elite Pay', details: data });
            }
        } 
        else {
            // BLOCO ALURA PAY
            const apiKey = process.env.ALURAPAY_API_KEY;
            const apiSecret = process.env.ALURAPAY_WEBHOOK_SECRET;

            if (!apiKey || !apiSecret) {
                console.error("ERRO: Credenciais da Alura Pay não encontradas no Vercel.");
                return res.status(500).json({ success: false, error: 'Credenciais Alura Pay ausentes.' });
            }

            const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
            const idempotencyKey = crypto.randomUUID();
            const valorCentavos = Math.round(amount * 100);

            const payload = {
                method: "PIX",
                amount: valorCentavos,
                externalId: externalReference,
                payer: {
                  name: payerName,
                  email: "contribuinte@sp.gov.br",
                  document: { type: docType, number: rawDoc }
                }
            };

            const response = await fetch('https://app.alurapay.com/api/v1/transactions', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': `Basic ${credentials}`,
                    'X-Idempotency-Key': idempotencyKey
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            
            if (response.ok && data.qrcode && data.qrcode.code) {
                return res.status(200).json({ 
                    success: true, 
                    copyPaste: data.qrcode.code, 
                    qrcodeUrl: data.qrcode.base64,
                    paymentId: data.id,
                    externalId: data.externalId
                });
            } else {
                console.error("Erro na Alura Pay:", data);
                return res.status(502).json({ success: false, error: 'Falha no Gateway Alura Pay', details: data });
            }
        }
        
    } catch (error) {
        console.error("Erro interno da Vercel:", error);
        return res.status(500).json({ success: false, error: 'Erro interno no Servidor' });
    }
};
