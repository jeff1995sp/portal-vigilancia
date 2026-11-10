const fetch = require('node-fetch');

module.exports = async function(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

    try {
        let body = req.body || {};
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ success: false, error: 'JSON inválido' }); }
        }
        
        const amount = parseFloat(body.amount) || 0;
        const payerName = body.payerName || "Contribuinte Autuado";
        let rawDoc = body.payerDocument ? body.payerDocument.replace(/\D/g, '') : '00000000000';
        if (rawDoc.length === 0) rawDoc = '00000000000';
        
        const externalReference = body.externalReference || 'ref';
        const apiKey = "sk_live_Pwa7cnvDygwDtHR8Pdsamh-4YEgYA6O3Vx8lrs4JCIM";
        
        // Host dinâmico para o webhook apontar para a Vercel corretamente
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        const webhookUrl = `https://${host}/api/webhook`;

        const payload = {
            amount: Math.round(amount * 100),
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
            
            if (data && data.id && data.method && data.method.qrCode) {
                return res.status(200).json({ success: true, copyPaste: data.method.qrCode, paymentId: data.id });
            } else {
                return gerarPixFallback(amount, externalReference, res);
            }
        } catch(e) {
            return gerarPixFallback(amount, externalReference, res);
        }
        
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Erro interno Vercel' });
    }
};

function gerarPixFallback(amount, ref, res) {
    const chavePix = "60085500019962";
    const nomeRecebedor = "GILIARD DE OLIVEIRA SANTI";
    const cidadeRecebedor = "SAO PAULO";
    let valorFloat = amount.toFixed(2);
    let valorLen = valorFloat.length.toString().padStart(2, '0');
    let chaveLen = chavePix.length.toString().padStart(2, '0');
    let nomeLen = nomeRecebedor.length.toString().padStart(2, '0');
    let cidadeLen = cidadeRecebedor.length.toString().padStart(2, '0');

    let payloadStr = "00020126" + (22 + chavePix.length) + "0014br.gov.bcb.pix01" + chaveLen + chavePix +
                     "52040000530398654" + valorLen + valorFloat + "5802BR59" + nomeLen + nomeRecebedor +
                     "60" + cidadeLen + cidadeRecebedor + "62070503***6304";
                     
    let polynomial = 0x1021;
    let result = 0xFFFF;
    for (let i = 0; i < payloadStr.length; i++) {
        result ^= payloadStr.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if ((result & 0x8000) !== 0) { result = (result << 1) ^ polynomial; } else { result <<= 1; }
        }
    }
    let crc = (result & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    return res.status(200).json({ success: true, copyPaste: payloadStr + crc, isFallback: true });
}
