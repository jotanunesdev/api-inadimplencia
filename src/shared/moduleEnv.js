function normalizePrefix(prefix) {
  if (!prefix) {
    throw new Error('Prefixo de variavel de ambiente e obrigatorio.');
  }

  return prefix.endsWith('_') ? prefix : `${prefix}_`;
}

function resolvePrefixedEnv(prefix, source = process.env) {
  const normalizedPrefix = normalizePrefix(prefix);
  const values = {};

  Object.entries(source).forEach(([key, value]) => {
    if (!key.startsWith(normalizedPrefix) || value === undefined) {
      return;
    }

    const cleanKey = key.slice(normalizedPrefix.length);
    if (!cleanKey) {
      return;
    }

    values[cleanKey] = value;
  });

  return values;
}

module.exports = {
  resolvePrefixedEnv,
};
