const fetch = require('node-fetch');

module.exports = async function(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const evento = req.body;
        console.log("Recebido Webhook da Alura Pay:", JSON.stringify(evento));
        
        const transaction = evento.transaction || evento;
        let statusPagamento = transaction.status || '';
        
        if (statusPagamento === 'APPROVED') {
            let pedidoId = transaction.externalId;

            if (pedidoId) {
                const projectId = 'site-8dfaf'; 
                const apiKey = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyDm4YNEuPxXKQm5g_yPinNIcNNneLVf1Rg'; 
                
                let colecao = "pedidos";
                if(pedidoId.startsWith("MULTA_")) {
                    colecao = "multas";
                    pedidoId = pedidoId.replace("MULTA_", "");
                }

                const firebaseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${colecao}/${pedidoId}?updateMask.fieldPaths=aguardando_alvara&key=${apiKey}`;

                const updatePayload = { fields: { aguardando_alvara: { booleanValue: true } } };

                const fireRes = await fetch(firebaseUrl, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatePayload)
                });

                if (fireRes.ok) {
                    console.log(`Sucesso: Firebase atualizado via Alura. ${colecao}/${pedidoId} marcado como AGUARDANDO ALVARÁ.`);
                }
            }
        }

        return res.status(200).json({ received: true });
        
    } catch (error) {
        console.error("Exceção fatal no processamento do Webhook da Alura Pay:", error);
        return res.status(500).json({ error: 'Erro Interno no Processamento' });
    }
};
