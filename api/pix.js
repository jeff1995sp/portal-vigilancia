export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

    const { amount, payerName, payerDocument, externalReference } = req.body;

    try {
        // Chamada segura para a EasyPix pelo Backend (Vercel)
        const response = await fetch('https://app-api.easy-pix.com/payments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.EASYPIX_API_KEY}` 
            },
            body: JSON.stringify({
                amount: Math.round(amount * 100), // Convertido para centavos 
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
            console.error("Erro detalhado da EasyPix:", data);
            return res.status(400).json({ success: false, error: data });
        }

    } catch (error) {
        console.error("Erro crítico no Gateway (Vercel):", error);
        return res.status(500).json({ success: false, error: 'Erro interno no servidor Vercel' });
    }
}
