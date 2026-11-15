const fetch = require('node-fetch');

module.exports = async function(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const evento = req.body;
        console.log("Recebido Webhook da Elite Pay:", JSON.stringify(evento));
        
        let statusPagamento = evento.transactionState || '';
        
        // Na Elite Pay, status concluído é 'COMPLETO'
        if (statusPagamento === 'COMPLETO') {
            
            let pedidoId = evento.externalReference; // ID mapeado na criação do PIX

            if (pedidoId) {
                console.log("ID do Pedido identificado no Webhook da Elite Pay:", pedidoId);
                const projectId = 'site-8dfaf'; 
                const apiKey = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyDm4YNEuPxXKQm5g_yPinNIcNNneLVf1Rg'; 
                
                let colecao = "pedidos";
                if(pedidoId.startsWith("MULTA_")) {
                    colecao = "multas";
                    pedidoId = pedidoId.replace("MULTA_", "");
                }

                // ATUALIZANDO PARA "aguardando_alvara" NO FIREBASE
                const firebaseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${colecao}/${pedidoId}?updateMask.fieldPaths=aguardando_alvara&key=${apiKey}`;

                const updatePayload = {
                    fields: {
                        aguardando_alvara: { booleanValue: true }
                    }
                };

                const fireRes = await fetch(firebaseUrl, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatePayload)
                });

                if (fireRes.ok) {
                    console.log(`Sucesso: Firebase atualizado via Elite Pay. ${colecao}/${pedidoId} marcado como AGUARDANDO ALVARÁ.`);
                } else {
                    const fireError = await fireRes.text();
                    console.error("Falha ao atualizar Firebase via Webhook. Resposta:", fireError);
                }
            } else {
                console.warn("Webhook Elite Pay recebido, mas não achei o externalReference no payload.");
            }
        } else {
            console.log("Ignorando webhook pois o status não é COMPLETO. Status recebido:", statusPagamento);
        }

        return res.status(200).json({ received: true });
        
    } catch (error) {
        console.error("Exceção fatal no processamento do Webhook da Elite Pay:", error);
        return res.status(500).json({ error: 'Erro Interno no Processamento' });
    }
};
