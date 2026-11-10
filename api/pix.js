const fetch = require('node-fetch');

module.exports = async function(req, res) {
    // CORS configuration
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        return res.status(200).json({ status: "API Gateway Online", provider: "EasyPix" });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    try {
        let body = req.body;
        
        // Em Vercel Serverless, req.body já vem como objeto (parsed json) se o content-type for application/json.
        // Se vier como string (por algum motivo), fazemos o parse manualmente.
        if (typeof body === 'string') {
            try {
                body = JSON.parse(body);
            } catch (e) {
                return res.status(400).json({ error: 'Body inválido.' });
            }
        }
        
        const amount = body.amount || 0;
        const payerName = body.payerName || "Contribuinte Autuado";
        const payerDocument = body.payerDocument || '00000000000';
        const externalReference = body.externalReference || 'ref';
        
        const apiKey = "sk_live_Pwa7cnvDygwDtHR8Pdsamh-4YEgYA6O3Vx8lrs4JCIM";

        const response = await fetch('https://app-api.easy-pix.com/payments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey
            },
            body: JSON.stringify({
                amount: Math.round(amount * 100), // Converte para centavos
                currency: 'BRL',
                idempotencyKey: externalReference + '_' + Date.now(),
                method: { type: 'qr_code' },
                customer: {
                    id: payerDocument,
                    name: payerName,
                    document: payerDocument
                }
            })
        });

        const data = await response.json();

        if (data && data.id && data.method && data.method.qrCode) {
            return res.status(200).json({ success: true, copyPaste: data.method.qrCode });
        } else {
            console.error("Erro da EasyPix:", data);
            return res.status(400).json({ success: false, error: data });
        }
    } catch (error) {
        console.error("Erro interno:", error);
        return res.status(500).json({ success: false, error: 'Erro interno no servidor' });
    }
};
