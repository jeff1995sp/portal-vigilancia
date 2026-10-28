export default async function handler(req, res) {
    // Permite que a ElitePay aceda a este ficheiro
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'POST') {
        try {
            // A ElitePay envia os dados do pagamento para cá
            const pagamento = req.body;
            console.log("Pagamento recebido da ElitePay:", JSON.stringify(pagamento));
            
            // Procura o status do pagamento na mensagem da ElitePay
            const status = pagamento.status || pagamento.state || pagamento.situacao || pagamento.transactionState || '';
            
            // Procura o ID do Firebase que enviámos na hora de gerar o Pix
            const idProcesso = pagamento.externalReference || pagamento.external_reference || '';

            // Verifica se o pagamento foi confirmado
            const pagoComSucesso = status.toUpperCase() === 'PAID' || 
                                   status.toUpperCase() === 'APPROVED' || 
                                   status.toUpperCase() === 'PAGO' ||
                                   status.toUpperCase() === 'COMPLETO' ||
                                   status.toUpperCase() === 'CONCLUIDO';

            // Se foi pago e a ElitePay devolveu o ID do Firebase
            if (pagoComSucesso && idProcesso) {
                
                // A SUA CHAVE DO FIREBASE
                const apiKey = "AIzaSyDm4YNEuPxXKQm5g_yPinNIcNNneLVf1Rg";

                // URL do Firebase COM a chave de segurança para permitir a gravação
                // Gravamos pago: true e aguardando_alvara: true
                const firebaseUrl = `https://firestore.googleapis.com/v1/projects/site-8dfaf/databases/(default)/documents/pedidos/${idProcesso}?updateMask.fieldPaths=pago&updateMask.fieldPaths=aguardando_alvara&key=${apiKey}`;
                
                const updateReq = await fetch(firebaseUrl, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fields: {
                            pago: { booleanValue: true },
                            aguardando_alvara: { booleanValue: true }
                        }
                    })
                });

                const updateRes = await updateReq.json();
                
                if (updateRes.error) {
                    console.error("Erro ao atualizar o Firebase:", updateRes.error);
                    return res.status(500).json({ error: 'Erro ao gravar no banco de dados' });
                }

                console.log(`Pedido ${idProcesso} marcado como pago no Firebase!`);
                return res.status(200).json({ success: true, message: "Firebase atualizado, tela do cliente liberada!" });
            }

            return res.status(200).json({ success: true, message: "Recebido, mas ignorado (ainda não foi pago ou falta ID)." });

        } catch (error) {
            console.error("Erro no Webhook:", error);
            return res.status(500).json({ error: 'Falha no processamento' });
        }
    }
    
    return res.status(405).json({ error: 'Método não permitido.' });
}
