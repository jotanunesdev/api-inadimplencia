export interface EstoqueOnlineKey {
  codigoPrd: string;
  codFilial: string;
  codLoc: string;
}

export interface EstoqueOnlineRow extends EstoqueOnlineKey {
  nomeFantasia: string;
  codUndControle: string | null;
  saldoMov: number | null;
  totalMov: number | null;
  custoMedio: number | null;
  estoqueMin: number | null;
}

export interface EstoqueMinPayload {
  estoqueMin: number;
}
