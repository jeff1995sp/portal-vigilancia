const fetch = require('node-fetch');

module.exports = async function(req, res) {
    // Configuração de CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

    try {
        let body = req.body || {};
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ success: false, error: 'JSON inválido na requisição do front-end.' }); }
        }
        
        const amount = parseFloat(body.amount) || 0;
        const payerName = body.payerName || "Contribuinte";
        let rawDoc = body.payerDocument ? body.payerDocument.replace(/\D/g, '') : '00000000000';
        if (rawDoc.length === 0) rawDoc = '00000000000';
        
        const externalReference = body.externalReference || 'ref';
        
        // Em produção, isso DEVE vir das variáveis de ambiente do Vercel: process.env.EASYPIX_API_KEY
        // Mantido aqui temporariamente para testes, como solicitado, mas recomendado colocar no Vercel Env Vars.
        const apiKey = process.env.EASYPIX_API_KEY || "sk_live_Pwa7cnvDygwDtHR8Pdsamh-4YEgYA6O3Vx8lrs4JCIM"; 
        
        // Host dinâmico para o webhook apontar para a Vercel corretamente
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        const webhookUrl = `https://${host}/api/webhook`;

        const payload = {
            amount: Math.round(amount * 100), // Converte para centavos
            currency: 'BRL',
            idempotencyKey: externalReference + '_' + Date.now(),
            method: { type: 'qr_code' },
            customer: { id: rawDoc, name: payerName, document: rawDoc },
            callbackUrl: webhookUrl, 
            metadata: {
                pedidoId: externalReference 
            }
        };

        try {
            const response = await fetch('https://app-api.easy-pix.com/payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            
            if (response.ok && data && data.id && data.method && data.method.qrCode) {
                return res.status(200).json({ success: true, copyPaste: data.method.qrCode, paymentId: data.id });
            } else {
                // Removemos o Fallback para evitar falsas cobranças e enviamos o erro real da EasyPix para debugar.
                console.error("Erro na EasyPix:", data);
                return res.status(502).json({ success: false, error: 'Falha no Gateway de Pagamento', details: data });
            }
        } catch(gatewayError) {
            console.error("Exceção ao chamar EasyPix:", gatewayError);
            return res.status(502).json({ success: false, error: 'Erro de comunicação com EasyPix', details: gatewayError.message });
        }
        
    } catch (error) {
        console.error("Erro interno do Vercel:", error);
        return res.status(500).json({ success: false, error: 'Erro interno no Servidor (Vercel)' });
    }
};
