"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEntryRecord = validateEntryRecord;
const errors_1 = require("../types/errors");
const normalize_1 = require("../utils/normalize");
const TOLERANCE = 0.01;
function ensureRequiredString(value, message, code) {
    if (!value || !value.trim()) {
        throw new errors_1.AppError(400, message, code);
    }
}
function ensurePositiveNumber(value, message, code) {
    if (value === null || value <= 0) {
        throw new errors_1.AppError(400, message, code);
    }
}
function ensureUnique(values, message, code) {
    const normalizedValues = values.filter((value) => Boolean(value));
    const uniqueValues = new Set(normalizedValues);
    if (uniqueValues.size !== normalizedValues.length) {
        throw new errors_1.AppError(400, message, code);
    }
}
function assertClose(expected, actual, message, code) {
    if (Math.abs((0, normalize_1.roundDecimal)(expected - actual)) > TOLERANCE) {
        throw new errors_1.AppError(400, message, code, {
            expected,
            actual,
        });
    }
}
function calculateItemsBrutoTotal(items) {
    return (0, normalize_1.roundDecimal)(items.reduce((total, item) => total + (item.valorBrutoItem ?? 0), 0));
}
function calculateItemsLiquidoTotal(items) {
    return (0, normalize_1.roundDecimal)(items.reduce((total, item) => total + (item.valorLiquido ?? 0), 0));
}
function calculateFinancialTotal(header, items) {
    return (0, normalize_1.roundDecimal)(calculateItemsLiquidoTotal(items) +
        (header.valorFrete ?? 0) +
        (header.valorDesp ?? 0) +
        (header.valorOutros ?? 0) -
        (header.valorDesc ?? 0));
}
function validateHeader(header) {
    ensureRequiredString(header.codColigada, 'O campo Coligada e obrigatorio.', 'HEADER_CODCOLIGADA_REQUIRED');
    ensureRequiredString(header.filialDescription, 'O campo Filial e obrigatorio.', 'HEADER_FILIAL_REQUIRED');
    ensureRequiredString(header.codFilial, 'O codigo da Filial e obrigatorio.', 'HEADER_CODFILIAL_REQUIRED');
    ensureRequiredString(header.numeroMov, 'Informe o Numero da Nota.', 'HEADER_NUMEROMOV_REQUIRED');
    ensureRequiredString(header.fornecedorDescription, 'O campo Fornecedor e obrigatorio.', 'HEADER_FORNECEDOR_REQUIRED');
    ensureRequiredString(header.codCfo, 'O codigo do Fornecedor e obrigatorio.', 'HEADER_CODCFO_REQUIRED');
    ensureRequiredString(header.codColCfo, 'O codigo da Coligada do Fornecedor e obrigatorio.', 'HEADER_CODCOLCFO_REQUIRED');
    ensureRequiredString(header.dataEmissao, 'Informe a Data de Emissao.', 'HEADER_DATAEMISSAO_REQUIRED');
    ensureRequiredString(header.dataSaida, 'Informe a Data de Entrada.', 'HEADER_DATASAIDA_REQUIRED');
    ensureRequiredString(header.movimentoDescription, 'O preenchimento do campo Movimento e obrigatorio.', 'HEADER_MOVIMENTO_REQUIRED');
    ensureRequiredString(header.codTmv, 'O codigo do Movimento e obrigatorio.', 'HEADER_CODTMV_REQUIRED');
    ensureRequiredString(header.serie, 'O preenchimento do campo Serie e obrigatorio.', 'HEADER_SERIE_REQUIRED');
    ensureRequiredString(header.idNat, 'O ID da Natureza e obrigatorio.', 'HEADER_IDNAT_REQUIRED');
    ensureRequiredString(header.codNat, 'O Codigo da Natureza e obrigatorio.', 'HEADER_CODNAT_REQUIRED');
    ensureRequiredString(header.naturezaDescription, 'O campo Natureza Fiscal e obrigatorio.', 'HEADER_NATUREZA_REQUIRED');
    if (header.qualidade === null) {
        throw new errors_1.AppError(400, 'O preenchimento do campo Qualidade e obrigatorio.', 'HEADER_QUALIDADE_REQUIRED');
    }
    if (header.prazo === null) {
        throw new errors_1.AppError(400, 'O preenchimento do campo Prazo e obrigatorio.', 'HEADER_PRAZO_REQUIRED');
    }
    if (header.atendimento === null) {
        throw new errors_1.AppError(400, 'O preenchimento do campo Atendimento e obrigatorio.', 'HEADER_ATENDIMENTO_REQUIRED');
    }
    ensurePositiveNumber(header.valorBruto, 'O campo Valor Bruto Total e obrigatorio.', 'HEADER_VALORBRUTO_REQUIRED');
    ensurePositiveNumber(header.valorLiquido, 'O campo Valor Liquido Total e obrigatorio.', 'HEADER_VALORLIQUIDO_REQUIRED');
    ensureRequiredString(header.historico, 'O preenchimento do campo Historico Automatico e obrigatorio.', 'HEADER_HISTORICO_REQUIRED');
    if (header.gerarFrap && !header.dataPrevBaixa) {
        throw new errors_1.AppError(400, 'O preenchimento do campo Data FAP e obrigatorio.', 'HEADER_DATAFAP_REQUIRED');
    }
    if ((0, normalize_1.hasValue)(header.chaveAcessoNfe) && String(header.chaveAcessoNfe).length !== 54) {
        throw new errors_1.AppError(400, 'O campo Chave de Acesso NFE deve ter 54 numeros.', 'HEADER_CHAVE_NFE_INVALID');
    }
}
function validatePurchaseOrders(purchaseOrders) {
    if (purchaseOrders.length === 0) {
        throw new errors_1.AppError(400, 'Adicione ao menos uma Ordem de Compra.', 'PURCHASE_ORDER_REQUIRED');
    }
    purchaseOrders.forEach((purchaseOrder, index) => {
        ensureRequiredString(purchaseOrder.idMov, `O ID do Movimento e obrigatorio na Ordem de Compra ${index + 1}.`, 'PURCHASE_ORDER_IDMOV_REQUIRED');
        ensureRequiredString(purchaseOrder.numeroMov, `O Numero do Movimento e obrigatorio na Ordem de Compra ${index + 1}.`, 'PURCHASE_ORDER_NUMEROMOV_REQUIRED');
        ensureRequiredString(purchaseOrder.codTmvOc, `O Codigo do Movimento e obrigatorio na Ordem de Compra ${index + 1}.`, 'PURCHASE_ORDER_CODTMVOC_REQUIRED');
    });
}
function validateItems(items) {
    if (items.length === 0) {
        throw new errors_1.AppError(400, 'Adicione ao menos um item.', 'ITEM_REQUIRED');
    }
    ensureUnique(items.map((item) => item.seqF), 'O sequencial unico dos itens nao pode se repetir.', 'ITEM_SEQF_DUPLICATED');
    items.forEach((item, index) => {
        ensureRequiredString(item.nomeFantasia, `A Descricao e obrigatoria no item ${index + 1}.`, 'ITEM_DESCRICAO_REQUIRED');
        ensureRequiredString(item.codigoPrd, `O Codigo do Item e obrigatorio no item ${index + 1}.`, 'ITEM_CODIGOPRD_REQUIRED');
        ensureRequiredString(item.idPrd, `O ID do Item e obrigatorio no item ${index + 1}.`, 'ITEM_IDPRD_REQUIRED');
        ensureRequiredString(item.codUnd, `A Unidade e obrigatoria no item ${index + 1}.`, 'ITEM_CODUND_REQUIRED');
        ensureRequiredString(item.nseqItmMov, `O Sequencial do Item e obrigatorio no item ${index + 1}.`, 'ITEM_NSEQ_REQUIRED');
        ensureRequiredString(item.idNat, `O ID da Natureza e obrigatorio no item ${index + 1}.`, 'ITEM_IDNAT_REQUIRED');
        ensureRequiredString(item.codNat, `O Codigo da Natureza e obrigatorio no item ${index + 1}.`, 'ITEM_CODNAT_REQUIRED');
        ensureRequiredString(item.descNat, `A Natureza Fiscal e obrigatoria no item ${index + 1}.`, 'ITEM_DESCNAT_REQUIRED');
        ensureRequiredString(item.codColTborcamento, `A Coligada da Natureza Orcamentaria e obrigatoria no item ${index + 1}.`, 'ITEM_CODCOLTB_REQUIRED');
        ensureRequiredString(item.codTborcamento, `O Codigo da Natureza Orcamentaria e obrigatorio no item ${index + 1}.`, 'ITEM_CODTB_REQUIRED');
        ensureRequiredString(item.descTborcamento, `A Descricao da Natureza Orcamentaria e obrigatoria no item ${index + 1}.`, 'ITEM_DESCTB_REQUIRED');
        ensureRequiredString(item.idMovOc, `O ID do Movimento de Origem e obrigatorio no item ${index + 1}.`, 'ITEM_IDMOVOC_REQUIRED');
        ensureRequiredString(item.nseqItmMovOc, `O Sequencial do Movimento de Origem e obrigatorio no item ${index + 1}.`, 'ITEM_NSEQOC_REQUIRED');
        ensurePositiveNumber(item.quantidade, `A Quantidade deve ser maior que zero no item ${index + 1}.`, 'ITEM_QUANTIDADE_INVALID');
        ensurePositiveNumber(item.precoUnitario, `O Preco Unitario deve ser maior que zero no item ${index + 1}.`, 'ITEM_PRECOUNITARIO_INVALID');
        ensurePositiveNumber(item.valorBrutoItem, `O Valor Bruto deve ser maior que zero no item ${index + 1}.`, 'ITEM_VALORBRUTO_INVALID');
        ensurePositiveNumber(item.valorTotalItem, `O Valor Total deve ser maior que zero no item ${index + 1}.`, 'ITEM_VALORTOTAL_INVALID');
        ensurePositiveNumber(item.valorLiquido, `O Valor Liquido deve ser maior que zero no item ${index + 1}.`, 'ITEM_VALORLIQUIDO_INVALID');
        const calculatedBruto = (0, normalize_1.roundDecimal)((item.quantidade ?? 0) * (item.precoUnitario ?? 0));
        assertClose(item.valorBrutoItem ?? 0, calculatedBruto, `O Valor Bruto do item ${index + 1} deve ser igual a Quantidade x Preco Unitario.`, 'ITEM_VALORBRUTO_MISMATCH');
    });
}
function validateApportionments(apportionments, items) {
    if (apportionments.length === 0) {
        throw new errors_1.AppError(400, 'Adicione ao menos um rateio.', 'APPORTIONMENT_REQUIRED');
    }
    ensureUnique(apportionments.map((apportionment) => apportionment.seqF), 'O sequencial unico dos rateios nao pode se repetir.', 'APPORTIONMENT_SEQF_DUPLICATED');
    apportionments.forEach((apportionment, index) => {
        ensureRequiredString(apportionment.descCusto, `O Centro de Custo e obrigatorio no rateio ${index + 1}.`, 'APPORTIONMENT_CENTROCUSTO_REQUIRED');
        ensureRequiredString(apportionment.codCcusto, `O Codigo do Centro de Custo e obrigatorio no rateio ${index + 1}.`, 'APPORTIONMENT_CODCCUSTO_REQUIRED');
        ensureRequiredString(apportionment.nseqItmMov, `O sequencial do item e obrigatorio no rateio ${index + 1}.`, 'APPORTIONMENT_NSEQ_REQUIRED');
        ensurePositiveNumber(apportionment.valor, `O valor do rateio ${index + 1} deve ser maior que zero.`, 'APPORTIONMENT_VALOR_INVALID');
    });
    items.forEach((item, index) => {
        const relatedApportionments = apportionments.filter((apportionment) => apportionment.nseqItmMov === item.nseqItmMov ||
            (apportionment.itemSeqF && apportionment.itemSeqF === item.seqF));
        if (relatedApportionments.length === 0) {
            throw new errors_1.AppError(400, `O item ${index + 1} precisa possuir ao menos um rateio.`, 'APPORTIONMENT_ITEM_REQUIRED');
        }
        const apportionedValue = (0, normalize_1.roundDecimal)(relatedApportionments.reduce((total, current) => total + (current.valor ?? 0), 0));
        assertClose(item.valorLiquido ?? 0, apportionedValue, `A soma dos rateios do item ${index + 1} deve ser igual ao valor liquido do item.`, 'APPORTIONMENT_ITEM_TOTAL_MISMATCH');
    });
}
function validateTaxes(taxes) {
    ensureUnique(taxes.map((tax) => tax.seqF), 'O sequencial unico dos tributos nao pode se repetir.', 'TAX_SEQF_DUPLICATED');
    taxes.forEach((tax, index) => {
        ensureRequiredString(tax.codTrb, `O Tributo e obrigatorio na linha ${index + 1}.`, 'TAX_CODTRB_REQUIRED');
        if (tax.baseDeCalculo === null) {
            throw new errors_1.AppError(400, `A Base de Calculo e obrigatoria na linha ${index + 1}.`, 'TAX_BASE_REQUIRED');
        }
        if (tax.aliquota === null) {
            throw new errors_1.AppError(400, `A Aliquota e obrigatoria na linha ${index + 1}.`, 'TAX_ALIQUOTA_REQUIRED');
        }
        ensureRequiredString(tax.tipoRecolhimento, `O Tipo de Recolhimento e obrigatorio na linha ${index + 1}.`, 'TAX_TIPORECOLHIMENTO_REQUIRED');
        if (tax.valor === null) {
            throw new errors_1.AppError(400, `O Valor do tributo e obrigatorio na linha ${index + 1}.`, 'TAX_VALOR_REQUIRED');
        }
    });
}
function validatePayments(payments, totalValue) {
    if (payments.length === 0) {
        throw new errors_1.AppError(400, 'Adicione ao menos um pagamento quando o Financeiro estiver habilitado.', 'PAYMENT_REQUIRED');
    }
    ensureUnique(payments.map((payment) => payment.seqF), 'O sequencial unico dos pagamentos nao pode se repetir.', 'PAYMENT_SEQF_DUPLICATED');
    const totalPayments = (0, normalize_1.roundDecimal)(payments.reduce((total, payment, index) => {
        ensureRequiredString(payment.codColigada, `A Coligada e obrigatoria no pagamento ${index + 1}.`, 'PAYMENT_CODCOLIGADA_REQUIRED');
        ensureRequiredString(payment.idMov, `O ID do Movimento e obrigatorio no pagamento ${index + 1}.`, 'PAYMENT_IDMOV_REQUIRED');
        ensureRequiredString(payment.idSeqPagto, `O Sequencial do Pagamento e obrigatorio no pagamento ${index + 1}.`, 'PAYMENT_IDSEQPAGTO_REQUIRED');
        ensureRequiredString(payment.dataVencimento, `A Data de Vencimento e obrigatoria no pagamento ${index + 1}.`, 'PAYMENT_DATAVENCIMENTO_REQUIRED');
        ensurePositiveNumber(payment.valor, `O Valor deve ser maior que zero no pagamento ${index + 1}.`, 'PAYMENT_VALOR_INVALID');
        return total + (payment.valor ?? 0);
    }, 0));
    assertClose(totalValue, totalPayments, 'A soma dos pagamentos deve ser igual ao Valor Liquido Total da nota.', 'PAYMENT_TOTAL_MISMATCH');
}
function validateEntryTotals(record) {
    const itemsBruto = calculateItemsBrutoTotal(record.items);
    const totalFinanceiro = calculateFinancialTotal(record.header, record.items);
    assertClose(record.header.valorBruto ?? 0, itemsBruto, 'O Valor Bruto Total deve ser igual a soma do Valor Bruto dos itens.', 'HEADER_VALORBRUTO_MISMATCH');
    assertClose(record.header.valorLiquido ?? 0, totalFinanceiro, 'O Valor Liquido Total deve ser igual aos itens somados com frete, despesa, outros e desconto.', 'HEADER_VALORLIQUIDO_MISMATCH');
}
function validateEntryRecord(record, mode) {
    if (mode === 'draft') {
        return;
    }
    validateHeader(record.header);
    validatePurchaseOrders(record.purchaseOrders);
    validateItems(record.items);
    validateApportionments(record.apportionments, record.items);
    validateTaxes(record.taxes);
    validateEntryTotals(record);
    if (record.header.financeiro) {
        validatePayments(record.payments, calculateFinancialTotal(record.header, record.items));
    }
}
