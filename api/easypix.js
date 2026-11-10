export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    const { amount, payerName, payerDocument, externalReference } = req.body;

    try {
        const apiKey = process.env.EASYPIX_API_KEY;
        if(!apiKey) {
             console.error("ERRO GRAVE: A variável EASYPIX_API_KEY não foi encontrada.");
             return res.status(500).json({ success: false, error: 'Chave API não configurada na Vercel.' });
        }

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
                    id: payerDocument || 'cliente_padrao',
                    name: payerName || "Contribuinte Autuado",
                    document: payerDocument
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
        console.error("Erro Gateway Vercel:", error);
        return res.status(500).json({ success: false, error: 'Erro interno no servidor' });
    }
}
