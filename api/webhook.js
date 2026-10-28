export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'POST') {
        try {
            const pagamento = req.body;
            console.log("Pagamento recebido da ElitePay:", JSON.stringify(pagamento));
            
            const status = pagamento.status || pagamento.state || pagamento.situacao || pagamento.transactionState || '';
            const idProcesso = pagamento.externalReference || pagamento.external_reference || '';

            const pagoComSucesso = status.toUpperCase() === 'PAID' || 
                                   status.toUpperCase() === 'APPROVED' || 
                                   status.toUpperCase() === 'PAGO' ||
                                   status.toUpperCase() === 'COMPLETO' ||
                                   status.toUpperCase() === 'CONCLUIDO';

            if (pagoComSucesso && idProcesso) {
                const apiKey = "AIzaSyDm4YNEuPxXKQm5g_yPinNIcNNneLVf1Rg";

                // AQUI ESTÁ O SEGREDO: Atualiza "aguardando_alvara" para true, e bloqueia o "pago" (false)
                const firebaseUrl = `https://firestore.googleapis.com/v1/projects/site-8dfaf/databases/(default)/documents/pedidos/${idProcesso}?updateMask.fieldPaths=aguardando_alvara&updateMask.fieldPaths=pago&key=${apiKey}`;
                
                const updateReq = await fetch(firebaseUrl, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fields: {
                            aguardando_alvara: { booleanValue: true },
                            pago: { booleanValue: false } // Garante que não vai liberar o Alvará
                        }
                    })
                });

                const updateRes = await updateReq.json();
                
                if (updateRes.error) {
                    console.error("Erro ao atualizar o Firebase:", updateRes.error);
                    return res.status(500).json({ error: 'Erro ao gravar no banco de dados' });
                }

                console.log(`Pedido ${idProcesso} marcado como AGUARDANDO ALVARÁ no Firebase!`);
                return res.status(200).json({ success: true, message: "Firebase atualizado: Aguardando Alvará" });
            }

            return res.status(200).json({ success: true, message: "Recebido, mas ignorado (ainda não foi pago ou falta ID)." });

        } catch (error) {
            console.error("Erro no Webhook:", error);
            return res.status(500).json({ error: 'Falha no processamento' });
        }
    }
    
    return res.status(405).json({ error: 'Método não permitido.' });
}
