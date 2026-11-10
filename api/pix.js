const fetch = require('node-fetch');

module.exports = async function(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    try {
        let body = req.body;
        
        if (!body) {
            body = {};
        } else if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch (e) {
                return res.status(400).json({ success: false, error: 'JSON inválido' });
            }
        }
        
        const amount = parseFloat(body.amount) || 0;
        const payerName = body.payerName || "Contribuinte Autuado";
        
        let rawDoc = body.payerDocument ? body.payerDocument.replace(/\D/g, '') : '00000000000';
        if (rawDoc.length === 0) rawDoc = '00000000000';
        
        const externalReference = body.externalReference || 'ref';
        const apiKey = "sk_live_Pwa7cnvDygwDtHR8Pdsamh-4YEgYA6O3Vx8lrs4JCIM";

        const payload = {
            amount: Math.round(amount * 100),
            currency: 'BRL',
            idempotencyKey: externalReference + '_' + Date.now(),
            method: { type: 'qr_code' },
            customer: {
                id: rawDoc,
                name: payerName,
                document: rawDoc
            }
        };

        const response = await fetch('https://app-api.easy-pix.com/payments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data && data.id && data.method && data.method.qrCode) {
            return res.status(200).json({ success: true, copyPaste: data.method.qrCode });
        } else {
            return res.status(400).json({ success: false, error: data });
        }
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Erro interno Vercel' });
    }
};
