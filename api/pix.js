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
        
        // CÁLCULO MANUAL DO PIX (FALLBACK SEGURO)
        // Se a EasyPix falhar, geramos o código BR Code (Copia e Cola) nós mesmos usando o seu CNPJ.
        // A chave informada nos HTMLs era o CNPJ: 60.085.500/0199-62
        const chavePix = "60085500019962";
        const nomeRecebedor = "GILIARD DE OLIVEIRA SANTI";
        const cidadeRecebedor = "SAO PAULO";
        
        function crc16(payload) {
            let polynomial = 0x1021;
            let result = 0xFFFF;
            for (let i = 0; i < payload.length; i++) {
                result ^= payload.charCodeAt(i) << 8;
                for (let j = 0; j < 8; j++) {
                    if ((result & 0x8000) !== 0) {
                        result = (result << 1) ^ polynomial;
                    } else {
                        result <<= 1;
                    }
                }
            }
            return (result & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
        }

        let valorFloat = amount.toFixed(2);
        let valorLen = valorFloat.length.toString().padStart(2, '0');
        let chaveLen = chavePix.length.toString().padStart(2, '0');
        let nomeLen = nomeRecebedor.length.toString().padStart(2, '0');
        let cidadeLen = cidadeRecebedor.length.toString().padStart(2, '0');

        let payloadStr = "000201" +
                         "26" + (22 + chavePix.length) + "0014br.gov.bcb.pix01" + chaveLen + chavePix +
                         "52040000" +
                         "5303986" +
                         "54" + valorLen + valorFloat +
                         "5802BR" +
                         "59" + nomeLen + nomeRecebedor +
                         "60" + cidadeLen + cidadeRecebedor +
                         "62070503***" +
                         "6304";
        let crc = crc16(payloadStr);
        let codigoCopiaCola = payloadStr + crc;

        // TENTATIVA NA EASYPIX (Caso você renove a chave)
        const payerName = body.payerName || "Contribuinte Autuado";
        let rawDoc = body.payerDocument ? body.payerDocument.replace(/\D/g, '') : '00000000000';
        if (rawDoc.length === 0) rawDoc = '00000000000';
        const externalReference = body.externalReference || 'ref';
        
        // A chave que você mandou na Vercel expirou. 
        const apiKey = "sk_live_Pwa7cnvDygwDtHR8Pdsamh-4YEgYA6O3Vx8lrs4JCIM";

        try {
            const response = await fetch('https://app-api.easy-pix.com/payments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + apiKey
                },
                body: JSON.stringify({
                    amount: Math.round(amount * 100),
                    currency: 'BRL',
                    idempotencyKey: externalReference + '_' + Date.now(),
                    method: { type: 'qr_code' },
                    customer: { id: rawDoc, name: payerName, document: rawDoc }
                })
            });

            const data = await response.json();

            // Se der erro Unauthorized, a gente usa o fallback!
            if (data && data.id && data.method && data.method.qrCode) {
                return res.status(200).json({ success: true, copyPaste: data.method.qrCode });
            } else {
                console.log("EasyPix falhou (provável API KEY inválida). Usando Fallback.");
                return res.status(200).json({ success: true, copyPaste: codigoCopiaCola });
            }
        } catch(e) {
            console.log("Servidor EasyPix não respondeu. Usando Fallback.");
            return res.status(200).json({ success: true, copyPaste: codigoCopiaCola });
        }
        
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Erro interno Vercel' });
    }
};
