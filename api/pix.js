export default async function handler(req, res) {
    // Configuração de CORS atualizada para permitir qualquer origem
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type, Authorization');

    // Responde ao 'preflight' do navegador
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido. Use POST.' });
    }

    const { amount, description, payerName, payerDocument } = req.body;

    try {
        const response = await fetch('https://api.elitepaybr.com/api/v1/deposit', {
            method: 'POST',
            headers: {
                'x-client-id': process.env.ELITEPAY_CLIENT_ID,
                'x-client-secret': process.env.ELITEPAY_CLIENT_SECRET,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: amount,
                description: description,
                payerName: payerName,
                payerDocument: payerDocument
            })
        });

        const data = await response.json();
        return res.status(200).json(data);

    } catch (error) {
        console.error("Erro na ElitePay:", error);
        return res.status(500).json({ success: false, error: 'Erro de comunicação com o Gateway' });
    }
}
