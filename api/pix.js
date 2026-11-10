const https = require('https');

module.exports = async function(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, content-type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Rota de Teste (GET) - Para ver se a API está online sem gerar 404/Erro
    if (req.method === 'GET') {
        return res.status(200).json({ status: "API Gateway Online", provider: "EasyPix" });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    try {
        const body = req.body || {};
        const { amount, description, payerName, payerDocument, externalReference } = body;
        const apiKey = "sk_live_Pwa7cnvDygwDtHR8Pdsamh-4YEGyA603Vx8lrs4JCIM";

        const response = await fetch('https://app-api.easy-pix.com/payments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey
            },
            body: JSON.stringify({
                amount: Math.round((amount || 0) * 100),
                currency: 'BRL',
                idempotencyKey: (externalReference || 'ref') + '_' + Date.now(),
                method: { type: 'qr_code' },
                customer: {
                    id: payerDocument || '00000000000',
                    name: payerName || "Contribuinte Autuado",
                    document: payerDocument || '00000000000'
                }
            })
        });

        const data = await response.json();

        if (data && data.id && data.method && data.method.qrCode) {
            return res.status(200).json({ success: true, copyPaste: data.method.qrCode });
        } else {
            return res.status(400).json({ success: false, error: data });
        }
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Erro interno no servidor' });
    }
};
