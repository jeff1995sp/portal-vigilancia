const fetch = require('node-fetch');

module.exports = async function(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const evento = req.body;
        
        let statusPagamento = evento.status || evento.state || '';
        
        // Verifica se o pagamento foi concluído
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
                const projectId = 'site-8dfaf'; 
                const apiKey = 'AIzaSyDm4YNEuPxXKQm5g_yPinNIcNNneLVf1Rg'; 
                
                let colecao = "pedidos";
                if(pedidoId.startsWith("MULTA_")) {
                    colecao = "multas";
                    pedidoId = pedidoId.replace("MULTA_", "");
                }

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
                    console.log(`Pedido ${pedidoId} atualizado para PAGO!`);
                } else {
                    console.error("Falha ao atualizar Firebase via Webhook:", await fireRes.text());
                }
            }
        }

        return res.status(200).json({ received: true });
        
    } catch (error) {
        console.error("Erro Webhook:", error);
        return res.status(500).json({ error: 'Erro Interno Webhook' });
    }
};
