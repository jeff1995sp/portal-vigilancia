module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido. Use POST.' });
    }

    const { amount, description, payerName, payerDocument, externalReference } = req.body;

    try {
        const apiKey = "sk_live_Pwa7cnvDygwDtHR8Pdsamh-4YEGyA603Vx8lrs4JCIM";

        const response = await fetch('https://app-api.easy-pix.com/payments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}` 
            },
            body: JSON.stringify({
                amount: Math.round(amount * 100), 
                currency: 'BRL',
                idempotencyKey: externalReference + '_' + Date.now(),
                method: { type: 'qr_code' },
                customer: {
                    id: payerDocument || '00000000000',
                    name: payerName || "Contribuinte Autuado",
                    document: payerDocument || '00000000000'
                }
            })
        });

        const data = await response.json();
        
        if (data.id && data.method && data.method.qrCode) {
            return res.status(200).json({ success: true, copyPaste: data.method.qrCode });
        } else {
            console.error("Erro da EasyPix:", data);
            return res.status(400).json({ success: false, error: data });
        }

    } catch (error) {
        console.error("Erro no Gateway:", error);
        return res.status(500).json({ success: false, error: 'Erro de comunicação com o Gateway' });
    }
};
