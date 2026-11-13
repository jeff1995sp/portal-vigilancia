const fetch = require('node-fetch');
const crypto = require('crypto');

module.exports = async function(req, res) {
    // Configuração de CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Idempotency-Key, token');

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
        
        const apiKey = process.env.ALURAPAY_API_KEY;

        if (!apiKey) {
            console.error("ERRO: ALURAPAY_API_KEY não encontrada no Vercel Env Vars.");
            return res.status(500).json({ success: false, error: 'Credenciais ausentes no servidor.' });
        }

        const idempotencyKey = crypto.randomUUID();
        const valorCentavos = Math.round(amount * 100);

        // O payload exato que a documentação pede
        const payload = {
            method: "PIX",
            amount: valorCentavos,
            externalId: externalReference, 
            payer: {
              name: payerName,
              email: "contribuinte@sp.gov.br",
              document: { 
                  type: docType, 
                  number: rawDoc 
              }
            }
        };

        try {
            const response = await fetch('https://app.alurapay.com/api/v1/transactions', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    // Removido o 'Basic' com base64 que estava causando Forbidden
                    // E adicionado token direto no cabeçalho ou Authorization Bearer
                    'Authorization': `Bearer ${apiKey}`,
                    'token': apiKey,
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
                return res.status(response.status || 502).json({ success: false, error: 'Falha no Gateway de Pagamento', details: data });
            }
        } catch(gatewayError) {
            console.error("Exceção ao chamar Alura Pay:", gatewayError);
            return res.status(502).json({ success: false, error: 'Erro de comunicação com a Alura Pay', details: gatewayError.message });
        }
        
    } catch (error) {
        console.error("Erro interno da Vercel:", error);
        return res.status(500).json({ success: false, error: 'Erro interno no Servidor' });
    }
};
