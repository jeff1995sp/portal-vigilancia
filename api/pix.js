const https = require('https');

module.exports = async function handler(req, res) {
    // Liberando o CORS para o frontend (seu site) poder chamar a API
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    const { amount, description, payerName, payerDocument, externalReference } = req.body;

    try {
        // Usa a chave que você me mandou
        const apiKey = "sk_live_Pwa7cnvDygwDtHR8Pdsamh-4YEGyA603Vx8lrs4JCIM";

        // Chama a API da EasyPix para gerar o QR Code
        const response = await fetch('https://app-api.easy-pix.com/payments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}` 
            },
            body: JSON.stringify({
                amount: Math.round(amount * 100), // Converte para centavos (EasyPix exige centavos)
                currency: 'BRL',
                idempotencyKey: externalReference + '_' + Date.now(),
                method: { type: 'qr_code' },
                customer: {
                    id: payerDocument || 'cliente_padrao',
                    name: payerName || "Contribuinte",
                    document: payerDocument
                }
            })
        });

        const data = await response.json();
        
        // Retorna pro front-end no formato que o index.html e admin.html esperam
        if (data.id && data.method && data.method.qrCode) {
            return res.status(200).json({ success: true, copyPaste: data.method.qrCode });
        } else {
            console.error("Erro da EasyPix:", data);
            return res.status(400).json({ success: false, error: data });
        }

    } catch (error) {
        console.error("Erro Gateway Vercel:", error);
        return res.status(500).json({ success: false, error: 'Erro interno no servidor Vercel' });
    }
}
