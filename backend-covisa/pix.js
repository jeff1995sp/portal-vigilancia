export default async function handler(req, res) {
    // 1. Configuração de CORS (Permite que o seu site HTML acesse essa API)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Responde ao 'preflight' do navegador
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido. Use POST.' });
    }

    // 2. Recebe os dados do seu Front-end (HTML)
    const { amount, description, payerName, payerDocument } = req.body;

    try {
        // 3. Chama a API da ElitePay de forma oculta
        const response = await fetch('https://api.elitepaybr.com/api/v1/deposit', {
            method: 'POST',
            headers: {
                // Pega as chaves das variáveis de ambiente do Vercel (nunca coloque elas direto aqui)
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

        // 4. Retorna o resultado (QR Code e Copia/Cola) para o seu site
        return res.status(200).json(data);

    } catch (error) {
        console.error("Erro na ElitePay:", error);
        return res.status(500).json({ success: false, error: 'Erro de comunicação com o Gateway' });
    }
}