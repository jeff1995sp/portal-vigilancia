const fetch = require('node-fetch');

module.exports = async function(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const evento = req.body;
        console.log("Recebido Webhook da EasyPix:", JSON.stringify(evento));
        
        let statusPagamento = evento.status || evento.state || '';
        
        // Verifica se o pagamento foi concluído (paid, approved, CONFIRMED)
        if (statusPagamento.toLowerCase() === 'paid' || statusPagamento.toLowerCase() === 'approved' || statusPagamento === 'CONFIRMED') {
            
            let pedidoId = null;
            if (evento.metadata && evento.metadata.pedidoId) {
                pedidoId = evento.metadata.pedidoId;
            } else if (evento.idempotencyKey) {
                pedidoId = evento.idempotencyKey.split('_')[0];
            } else if (evento.external_reference) {
                 pedidoId = evento.external_reference;
            } else if (evento.payment && evento.payment.metadata && evento.payment.metadata.pedidoId) {
                 pedidoId = evento.payment.metadata.pedidoId;
            }

            if (pedidoId) {
                console.log("ID do Pedido identificado no Webhook:", pedidoId);
                const projectId = 'site-8dfaf'; 
                // É recomendado colocar apiKey web no process.env.FIREBASE_WEB_API_KEY
                const apiKey = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyDm4YNEuPxXKQm5g_yPinNIcNNneLVf1Rg'; 
                
                let colecao = "pedidos";
                if(pedidoId.startsWith("MULTA_")) {
                    colecao = "multas";
                    pedidoId = pedidoId.replace("MULTA_", "");
                }

                // URL da API REST do Firestore para atualizar o campo "pago"
                const firebaseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${colecao}/${pedidoId}?updateMask.fieldPaths=pago&key=${apiKey}`;

                const updatePayload = {
                    fields: {
                        pago: { booleanValue: true }
                    }
                };

                const fireRes = await fetch(firebaseUrl, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatePayload)
                });

                if (fireRes.ok) {
                    console.log(`Sucesso: Firebase atualizado. ${colecao}/${pedidoId} marcado como PAGO.`);
                } else {
                    const fireError = await fireRes.text();
                    console.error("Falha ao atualizar Firebase via Webhook. Resposta do Firebase:", fireError);
                }
            } else {
                console.warn("Webhook recebido de pagamento aprovado, mas nenhum pedidoId / externalReference foi encontrado no payload.");
            }
        } else {
            console.log("Ignorando webhook pois o status não é de pagamento concluído. Status recebido:", statusPagamento);
        }

        // Responde 200 OK para o Gateway parar de reenviar o webhook
        return res.status(200).json({ received: true });
        
    } catch (error) {
        console.error("Exceção fatal no processamento do Webhook:", error);
        return res.status(500).json({ error: 'Erro Interno no Processamento do Webhook' });
    }
};
