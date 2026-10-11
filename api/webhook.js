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
            
            // Procura o status do pagamento na mensagem da ElitePay
            const status = pagamento.status || pagamento.state || pagamento.situacao || '';
            
            // Procura a descrição que enviámos na hora de gerar o Pix
            const descricao = pagamento.description || pagamento.reference_id || pagamento.external_reference || '';

            // Verifica se o pagamento foi confirmado ("PAID", "APPROVED", etc.)
            const pagoComSucesso = status.toUpperCase() === 'PAID' || 
                                   status.toUpperCase() === 'APPROVED' || 
                                   status.toUpperCase() === 'PAGO' ||
                                   status.toUpperCase() === 'CONCLUIDO';

            // Se foi pago e tem o ID do processo na descrição
            if (pagoComSucesso && descricao.includes('Taxa COVISA - Processo ')) {
                
                // Extrai o ID do Firebase que escondemos na descrição
                const idProcesso = descricao.split('Processo ')[1].trim();

                // Atualiza o Firebase diretamente via API (Muda para pago: true)
                const firebaseUrl = `https://firestore.googleapis.com/v1/projects/site-8dfaf/databases/(default)/documents/pedidos/${idProcesso}?updateMask.fieldPaths=pago`;
                
                await fetch(firebaseUrl, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fields: {
                            pago: { booleanValue: true }
                        }
                    })
                });

                return res.status(200).json({ success: true, message: "Firebase atualizado, tela do cliente liberada!" });
            }

            return res.status(200).json({ success: true, message: "Recebido, mas não precisava de ação." });

        } catch (error) {
            console.error("Erro no Webhook:", error);
            return res.status(500).json({ error: 'Falha no processamento' });
        }
    }
    
    return res.status(405).json({ error: 'Método não permitido.' });
}