const { fetchFichaFinanceiraUrl } = require('../services/rmReportService');

async function getFichaFinanceira(req, res, next) {
  try {
    const numVenda = String(req.query.numVenda || '').trim();
    const codColigada = req.query.codColigada ? Number(req.query.codColigada) : undefined;
    const reportColigada = req.query.reportColigada ? Number(req.query.reportColigada) : undefined;
    const reportId = req.query.reportId ? Number(req.query.reportId) : undefined;

    if (!numVenda) {
      return res.status(400).json({ error: 'numVenda e obrigatorio.' });
    }

    const url = await fetchFichaFinanceiraUrl({ numVenda, codColigada, reportId, reportColigada });
    return res.json({
      url,
      numVenda,
      codColigada: codColigada ?? 1,
      reportColigada: reportColigada ?? undefined,
      reportId: reportId ?? undefined,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getFichaFinanceira,
};
