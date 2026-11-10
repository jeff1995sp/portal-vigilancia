const https = require('https');

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, PATCH, DELETE',
        'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    
    // Rota de Teste (GET) - Para ver se a API está online sem gerar 404/Erro
    if (event.httpMethod === 'GET') {
        return { 
            statusCode: 200, 
            headers, 
            body: JSON.stringify({ status: 'API Gateway Operacional', provider: 'EasyPix' }) 
        };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método não permitido. Use POST.' }) };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { amount, description, payerName, payerDocument, externalReference } = body;
        
        // Chave oficial do EasyPix
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
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, copyPaste: data.method.qrCode })
            };
        } else {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: data })
            };
        }
    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: 'Erro interno no servidor' })
        };
    }
};
