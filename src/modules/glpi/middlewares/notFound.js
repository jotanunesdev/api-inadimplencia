function notFound(req, res) {
  res.status(404).json({
    error: 'Endpoint nao encontrado',
  });
}

module.exports = {
  notFound,
};
