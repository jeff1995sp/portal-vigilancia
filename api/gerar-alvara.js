import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Apenas requisições POST.' });
  }

  try {
    const dados = req.body;

    const pdfPath = path.join(process.cwd(), 'Alvara Provisório (1)_3.pdf');
    if (!fs.existsSync(pdfPath)) {
      return res.status(500).json({ error: 'PDF base não encontrado.' });
    }

    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const page = pdfDoc.getPages()[0];
    
    const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const preto = rgb(0, 0, 0);

    const escrever = (texto, x, y, isBold = false, size = 9, max = 90) => {
      if (!texto) return;
      let str = String(texto).toUpperCase();
      if (str.length > max) str = str.substring(0, max - 3) + '...';
      page.drawText(str, { x, y, size, font: isBold ? fontBold : fontReg, color: preto });
    };

    const desenharCaixa = (x, y, w, h) => {
      page.drawRectangle({ x, y, width: w, height: h, borderColor: preto, borderWidth: 1, color: undefined });
    };

    const desenharLinha = (x1, y1, x2, y2) => {
      page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 1, color: preto });
    };

    // =========================================================================
    // 1. TÍTULO E CEVS (CAIXAS SUPERIORES)
    // =========================================================================
    
    // Caixa do Título
    desenharCaixa(25, 715, 545, 25);
    escrever('CERTIFICADO DE REGULARIDADE SANITÁRIA', 170, 723, true, 12);

    // Caixa do CEVS
    desenharCaixa(25, 690, 545, 20);
    escrever('Nº CEVS:', 30, 696, true);
    escrever(dados.cevs || '355030890-812-000064-1-6', 80, 696, false);

    // Nota Solta (Sem caixa)
    escrever('NOTA: ESTE DOCUMENTO CONTÉM 1 PÁGINA(S)', 330, 675, false, 8);

    // =========================================================================
    // 2. CAIXA GIGANTE DO MEIO (DADOS DO PROCESSO + DADOS DA EMPRESA)
    // =========================================================================
    
    // Desenha a caixa principal inteira
    desenharCaixa(25, 420, 545, 245);
    
    // Linha divisória no meio (Separando "DETALHE" da "RAZÃO SOCIAL")
    desenharLinha(25, 525, 570, 525);

    let y = 650;
    escrever('Nº PROCESSO:', 30, y, true);
    escrever(dados.processo || 'SES-ESP-2022/97376', 170, y, false);
    
    y -= 15;
    escrever('Nº PROTOCOLO:', 30, y, true);
    escrever(dados.protocolo || 'GERADO ONLINE', 170, y, false);

    y -= 20;
    escrever('SUBGRUPO:', 30, y, true);
    escrever(dados.subgrupo || 'PRESTAÇÃO DE SERVIÇOS COM PRODUTOS', 170, y, false);
    escrever('RELACIONADOS À SAÚDE', 170, y - 12, false);

    y -= 30;
    escrever('AGRUPAMENTO:', 30, y, true);
    escrever(dados.agrupamento || 'CONTROLE DE PRAGAS URBANAS E SERVIÇO DE', 170, y, false);
    escrever('ESTERILIZAÇÃO', 170, y - 12, false);

    y -= 30;
    escrever('ATIVIDADE ECONÔMICA-CNAE:', 30, y, true);
    escrever(dados.cnae || '8122-2/00 CONTROLE DE PRAGAS URBANAS', 170, y, false);

    y -= 15;
    escrever('OBJETO LICENCIADO:', 30, y, true);
    escrever(dados.objeto_licenciado || 'ESTABELECIMENTO', 170, y, false);

    y -= 15;
    escrever('DETALHE:', 30, y, true);
    escrever(dados.detalhe || '', 170, y, false, 9, 65);

    // --- Parte de baixo da caixa gigante (Dados da Empresa Nex One) ---
    y = 510; 
    escrever('RAZÃO SOCIAL:', 30, y, true);
    escrever(dados.razao_social || 'NEX ONE SENA MADUREIRA (CONDOMINIO NEX ONE)', 170, y, false, 9, 70);

    y -= 12;
    escrever('CNPJ:', 30, y, true);
    escrever(dados.cnpj || '52.480.715/0001-92', 170, y, false);

    y -= 12;
    escrever('DATA DE EMISSÃO:', 30, y, true);
    escrever(dados.data_emissao || '27/10/2026', 170, y, false);

    y -= 12;
    escrever('VÁLIDO ATÉ:', 30, y, true);
    escrever(dados.valido_ate || '27/10/2027', 170, y, false);

    y -= 12;
    escrever('ENDEREÇO COMPLETO:', 30, y, true);
    escrever(dados.endereco || 'SENA MADUREIRA, 249', 170, y, false);

    y -= 12;
    escrever('BAIRRO:', 30, y, true);
    escrever(dados.bairro || 'VILA CLEMENTINO', 170, y, false);

    y -= 12;
    escrever('CEP:', 30, y, true);
    escrever(dados.cep || '04021050', 170, y, false);

    y -= 12;
    escrever('MUNICÍPIO / UF:', 30, y, true);
    escrever(`${dados.municipio || 'SAO PAULO'} - ${dados.uf || 'SP'}`, 170, y, false);

    // =========================================================================
    // 3. CAIXAS DOS RESPONSÁVEIS LEGAIS E TÉCNICOS
    // =========================================================================
    
    // CAIXA 1 (Responsável Legal)
    y = 405;
    desenharCaixa(25, 375, 545, 40); 
    
    escrever('RESPONSÁVEL LEGAL:', 30, y, true);
    escrever(dados.responsavel_1 || 'MIGUEL LOPES GOUVEIA', 155, y, false);
    
    y -= 13;
    escrever('CPF: ', 30, y, true); escrever(dados.cpf_1 || '01284208964', 55, y, false);
    escrever('CONSELHO REGIONAL: ', 350, y, true); escrever(dados.conselho_1 || 'N/A', 460, y, false);
    
    y -= 13;
    escrever('Nº INSCR. CONSELHO PROF.: ', 30, y, true); escrever(dados.inscricao_1 || 'NC', 175, y, false);
    escrever('UF: ', 350, y, true); escrever('SP', 370, y, false);

    // CAIXA 2 (Responsável Técnico)
    y = 360;
    desenharCaixa(25, 330, 545, 40); 
    
    escrever('RESPONSÁVEL LEGAL:', 30, y, true); // O seu print diz LEGAL nos dois
    escrever(dados.responsavel_2 || 'GILIARD DE OLIVEIRA SANTIAGO', 155, y, false);
    
    y -= 13;
    escrever('CPF: ', 30, y, true); escrever(dados.cpf_2 || '02953112235', 55, y, false);
    escrever('CONSELHO REGIONAL: ', 350, y, true); escrever(dados.conselho_2 || 'CRQ', 460, y, false);
    
    y -= 13;
    escrever('Nº INSCR. CONSELHO PROF.: ', 30, y, true); escrever(dados.inscricao_2 || '04438914', 175, y, false);
    escrever('UF: ', 350, y, true); escrever('SP', 370, y, false);

    // =========================================================================
    // 4. TEXTO DO CERTIFICADO (Abaixo das tabelas)
    // =========================================================================
    y = 295;
    escrever('CERTIFICAÇÃO PROVISÓRIA DE FUNCIONAMENTO', 150, y, true, 11);

    y -= 25;
    escrever('A Coordenação de Vigilância em Saúde declara que o estabelecimento acima identificado cumpriu as', 30, y, false, 9.5);
    y -= 13;
    escrever('obrigações administrativas relativas à regularização do pagamento da Taxa de Análise de Pendências.', 30, y, false, 9.5);

    y -= 20;
    escrever('Esta certificação provisória autoriza o funcionamento do local até a vistoria técnica conclusiva, desde que haja', 30, y, false, 9.5);
    y -= 13;
    escrever('conformidade entre as condições físicas verificadas, os dados cadastrados no sistema e o cumprimento das Boas', 30, y, false, 9.5);
    y -= 13;
    escrever('Práticas e da legislação sanitária vigente.', 30, y, false, 9.5);

    y -= 25;
    escrever('INFORMAÇÕES E CONDICIONANTES:', 30, y, true, 9.5);
    y -= 15;
    escrever('• Manter este alvará provisório impresso e visível durante o funcionamento.', 30, y, false, 9.5);
    y -= 13;
    escrever('• Fraudes, omissões ou divergências graves poderão resultar em cassação, interdição e encaminhamento aos', 30, y, false, 9.5);
    y -= 13;
    escrever('órgãos competentes.', 30, y, false, 9.5);
    y -= 13;
    escrever('• A autenticidade deve ser confirmada nos canais oficiais do SIVISA.', 30, y, false, 9.5);

    const pdfModificado = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Certificado_Sivisa.pdf`);
    res.send(Buffer.from(pdfModificado));

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao processar PDF' });
  }
}