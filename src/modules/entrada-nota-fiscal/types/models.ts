export type SaveMode = 'draft' | 'submit';
export type EntryStatus = 'draft' | 'pending_analysis' | 'approved' | 'rejected';

export interface EntryListQuery {
  search?: string;
  status?: EntryStatus | 'all';
  page: number;
  pageSize: number;
}

export interface EntryHeaderInput {
  filialDescription?: string | null;
  codColigada?: string | null;
  codFilial?: string | null;
  numeroMov?: string | null;
  fornecedorDescription?: string | null;
  codCfo?: string | null;
  codColCfo?: string | null;
  cnpjCpf?: string | null;
  dataEmissao?: string | null;
  dataSaida?: string | null;
  localEstoqueDescription?: string | null;
  codLoc?: string | null;
  movimentoDescription?: string | null;
  codTmv?: string | null;
  codTdo?: string | null;
  serie?: string | null;
  idNat?: string | null;
  codNat?: string | null;
  naturezaDescription?: string | null;
  qualidade?: number | string | null;
  prazo?: number | string | null;
  atendimento?: number | string | null;
  valorBruto?: number | string | null;
  valorLiquido?: number | string | null;
  valorFrete?: number | string | null;
  valorDesc?: number | string | null;
  valorDesp?: number | string | null;
  valorOutros?: number | string | null;
  chaveAcessoNfe?: string | null;
  gerarFrap?: boolean | string | null;
  dataPrevBaixa?: string | null;
  historico?: string | null;
  observacaoAvaliacao?: string | null;
  financeiro?: boolean | string | null;
  possuiAdiantamento?: boolean | string | null;
  codCpg?: string | null;
  descricaoCodCpg?: string | null;
  codCxa?: string | null;
  descricaoCodCxa?: string | null;
}

export interface EntryPurchaseOrderInput {
  lineNumber?: number | string | null;
  seqF?: string | null;
  idMov?: string | null;
  numeroMov?: string | null;
  codTmvOc?: string | null;
  tipoMovimento?: string | null;
  dataEmissao?: string | null;
  valor?: number | string | null;
  cgcCfo?: string | null;
  fornecedorNome?: string | null;
  movimentoDestinoCodigo?: string | null;
  movimentoDestinoDescricao?: string | null;
}

export interface EntryItemInput {
  lineNumber?: number | string | null;
  seqF?: string | null;
  nomeFantasia?: string | null;
  codigoPrd?: string | null;
  idPrd?: string | null;
  codUnd?: string | null;
  nseqItmMov?: string | null;
  idNat?: string | null;
  codNat?: string | null;
  descNat?: string | null;
  codColTborcamento?: string | null;
  codTborcamento?: string | null;
  descTborcamento?: string | null;
  idMovOc?: string | null;
  nseqItmMovOc?: string | null;
  quantidade?: number | string | null;
  precoUnitario?: number | string | null;
  valorBrutoItem?: number | string | null;
  valorTotalItem?: number | string | null;
  valorLiquido?: number | string | null;
}

export interface EntryApportionmentInput {
  lineNumber?: number | string | null;
  seqF?: string | null;
  itemSeqF?: string | null;
  nseqItmMov?: string | null;
  descCusto?: string | null;
  codCcusto?: string | null;
  valor?: number | string | null;
}

export interface EntryTaxInput {
  lineNumber?: number | string | null;
  seqF?: string | null;
  itemSeqF?: string | null;
  nseqItmMov?: string | null;
  codTrb?: string | null;
  sitTributaria?: string | null;
  baseDeCalculo?: number | string | null;
  aliquota?: number | string | null;
  tipoRecolhimento?: string | null;
  valor?: number | string | null;
}

export interface EntryPaymentInput {
  lineNumber?: number | string | null;
  seqF?: string | null;
  codColigada?: string | null;
  idMov?: string | null;
  idSeqPagto?: string | null;
  dataVencimento?: string | null;
  valor?: number | string | null;
  descFormaPagto?: string | null;
  idFormaPagto?: string | null;
  tipoFormaPagto?: string | null;
  codColCxa?: string | null;
  descCodCxa?: string | null;
  codCxa?: string | null;
  tipoPagamento?: string | null;
  debitoCredito?: string | null;
  taxaAdm?: number | string | null;
  idLan?: string | null;
  adtIntegrado?: string | null;
  linhaDigitavel?: string | null;
}

export interface EntryReviewInput {
  reviewedBy?: string | null;
  comment?: string | null;
}

export interface EntryRecordInput {
  mode?: SaveMode;
  requestedBy?: string | null;
  header?: EntryHeaderInput;
  purchaseOrders?: EntryPurchaseOrderInput[];
  items?: EntryItemInput[];
  apportionments?: EntryApportionmentInput[];
  taxes?: EntryTaxInput[];
  payments?: EntryPaymentInput[];
}

export interface EntryHeader {
  filialDescription: string | null;
  codColigada: string | null;
  codFilial: string | null;
  numeroMov: string | null;
  fornecedorDescription: string | null;
  codCfo: string | null;
  codColCfo: string | null;
  cnpjCpf: string | null;
  dataEmissao: string | null;
  dataSaida: string | null;
  localEstoqueDescription: string | null;
  codLoc: string | null;
  movimentoDescription: string | null;
  codTmv: string | null;
  codTdo: string | null;
  serie: string | null;
  idNat: string | null;
  codNat: string | null;
  naturezaDescription: string | null;
  qualidade: number | null;
  prazo: number | null;
  atendimento: number | null;
  valorBruto: number | null;
  valorLiquido: number | null;
  valorFrete: number | null;
  valorDesc: number | null;
  valorDesp: number | null;
  valorOutros: number | null;
  chaveAcessoNfe: string | null;
  gerarFrap: boolean;
  dataPrevBaixa: string | null;
  historico: string | null;
  observacaoAvaliacao: string | null;
  financeiro: boolean;
  possuiAdiantamento: boolean;
  codCpg: string | null;
  descricaoCodCpg: string | null;
  codCxa: string | null;
  descricaoCodCxa: string | null;
}

export interface EntryPurchaseOrder {
  lineNumber: number;
  seqF: string | null;
  idMov: string | null;
  numeroMov: string | null;
  codTmvOc: string | null;
  tipoMovimento: string | null;
  dataEmissao: string | null;
  valor: number | null;
  cgcCfo: string | null;
  fornecedorNome: string | null;
  movimentoDestinoCodigo: string | null;
  movimentoDestinoDescricao: string | null;
}

export interface EntryItem {
  lineNumber: number;
  seqF: string | null;
  nomeFantasia: string | null;
  codigoPrd: string | null;
  idPrd: string | null;
  codUnd: string | null;
  nseqItmMov: string | null;
  idNat: string | null;
  codNat: string | null;
  descNat: string | null;
  codColTborcamento: string | null;
  codTborcamento: string | null;
  descTborcamento: string | null;
  idMovOc: string | null;
  nseqItmMovOc: string | null;
  quantidade: number | null;
  precoUnitario: number | null;
  valorBrutoItem: number | null;
  valorTotalItem: number | null;
  valorLiquido: number | null;
}

export interface EntryApportionment {
  lineNumber: number;
  seqF: string | null;
  itemSeqF: string | null;
  nseqItmMov: string | null;
  descCusto: string | null;
  codCcusto: string | null;
  valor: number | null;
}

export interface EntryTax {
  lineNumber: number;
  seqF: string | null;
  itemSeqF: string | null;
  nseqItmMov: string | null;
  codTrb: string | null;
  sitTributaria: string | null;
  baseDeCalculo: number | null;
  aliquota: number | null;
  tipoRecolhimento: string | null;
  valor: number | null;
}

export interface EntryPayment {
  lineNumber: number;
  seqF: string | null;
  codColigada: string | null;
  idMov: string | null;
  idSeqPagto: string | null;
  dataVencimento: string | null;
  valor: number | null;
  descFormaPagto: string | null;
  idFormaPagto: string | null;
  tipoFormaPagto: string | null;
  codColCxa: string | null;
  descCodCxa: string | null;
  codCxa: string | null;
  tipoPagamento: string | null;
  debitoCredito: string | null;
  taxaAdm: number | null;
  idLan: string | null;
  adtIntegrado: string | null;
  linhaDigitavel: string | null;
}

export interface EntryRecord {
  id: string;
  status: EntryStatus;
  mode: SaveMode;
  requestedBy: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  reviewComment: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rmMovementId: string | null;
  rmPrimaryKey: string | null;
  rmIntegrationStatus: string | null;
  rmIntegrationMessage: string | null;
  createdAt: string;
  updatedAt: string;
  header: EntryHeader;
  purchaseOrders: EntryPurchaseOrder[];
  items: EntryItem[];
  apportionments: EntryApportionment[];
  taxes: EntryTax[];
  payments: EntryPayment[];
}

export interface EntryListItem {
  id: string;
  status: EntryStatus;
  numeroMov: string | null;
  serie: string | null;
  fornecedorDescription: string | null;
  filialDescription: string | null;
  dataEmissao: string | null;
  valorLiquido: number | null;
  requestedBy: string | null;
  rmMovementId: string | null;
  reviewComment: string | null;
  updatedAt: string;
}

export interface EntryListResponse {
  items: EntryListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface FormMetadataResponse {
  ratings: Array<{ value: number; label: string }>;
  statuses: Array<{ value: EntryStatus; label: string }>;
  saveModes: Array<{ value: SaveMode; label: string }>;
  defaults: {
    codColigada: string;
    coligadaDescription: string;
  };
  sections: Array<{
    key: string;
    label: string;
    description: string;
  }>;
}
