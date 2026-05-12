const { env } = require('../config/env');

const UAT_TEST_DOCUMENTS = Object.freeze([
  '00001209523',
  '00008441448',
  '07420565899',
  '04236798484',
  '43557445000180',
  '00079854000105',
  '16881670052',
  '11572467886',
]);

const SERASA_CONSTANTS = Object.freeze({
  CATEGORY_ID: 'FI',
  DEBT_TYPE: 'PEFIN',
  MIN_VALUE: 10.0,
  MAX_VALUE_DIGITS: 15,
  VALUE_DECIMALS: 2,
});

function digitsOnly(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).replace(/\D/g, '');
}

function normalizeString(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
}

function normalizeCurrency(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDate(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }
    return value.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  const match = text.match(/^(\d{4})[-/]?(\d{2})[-/]?(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const dmyMatch = text.match(/^(\d{2})[-/]?(\d{2})[-/]?(\d{4})/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
  }
  return null;
}

function normalizeAddress(address) {
  if (!address || typeof address !== 'object') {
    return null;
  }
  return {
    zipCode: normalizeString(address.zipCode ?? address.CEP ?? address.cep),
    addressLine: normalizeString(address.addressLine ?? address.logradouro ?? address.ENDERECO),
    complement: normalizeString(address.complement ?? address.complemento ?? address.COMPLEMENTO),
    district: normalizeString(address.district ?? address.bairro ?? address.BAIRRO),
    city: normalizeString(address.city ?? address.municipio ?? address.CIDADE ?? address.MUNICIPIO ?? address.cidade),
    state: normalizeString(address.state ?? address.uf ?? address.UF ?? address.ESTADO),
    number: normalizeString(address.number ?? address.numero ?? address.NUMERO),
  };
}

function validateDateFormat(dateStr) {
  if (!dateStr) {
    return false;
  }
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) {
    return false;
  }
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  const constructedDate = new Date(year, month - 1, day);
  return (
    constructedDate.getFullYear() === year &&
    constructedDate.getMonth() === month - 1 &&
    constructedDate.getDate() === day
  );
}

function validateValue(value) {
  if (value === null || value === undefined) {
    return false;
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return false;
  }
  return num >= SERASA_CONSTANTS.MIN_VALUE;
}

function validateAddress(address, prefix = '') {
  const missingFields = [];
  const normalized = normalizeAddress(address);

  if (!normalized) {
    return {
      valid: false,
      missingFields: [`${prefix}address`],
      normalized: null,
    };
  }

  const requiredFields = [
    ['zipCode', normalized.zipCode],
    ['addressLine', normalized.addressLine],
    ['district', normalized.district],
    ['city', normalized.city],
    ['state', normalized.state],
  ];

  requiredFields.forEach(([field, value]) => {
    if (!value) {
      missingFields.push(prefix ? `${prefix}${field}` : field);
    }
  });

  return {
    valid: missingFields.length === 0,
    missingFields,
    normalized,
  };
}

function validateUatDocuments(documents, uatEnabled = env.SERASA_UAT_ENABLED) {
  if (!uatEnabled) {
    return { valid: true, blockedDocuments: [] };
  }

  const docsArray = Array.isArray(documents) ? documents : [documents];
  const blockedDocuments = [];

  for (const doc of docsArray) {
    const normalized = digitsOnly(doc);
    if (!normalized) {
      continue;
    }
    if (!UAT_TEST_DOCUMENTS.includes(normalized)) {
      blockedDocuments.push(normalized);
    }
  }

  return {
    valid: blockedDocuments.length === 0,
    blockedDocuments,
  };
}

function buildDomainError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function validateMainDebtInput(params) {
  const missingFields = [];

  if (!params.value || !validateValue(params.value)) {
    missingFields.push('value');
  }

  if (!params.dueDate || !validateDateFormat(params.dueDate)) {
    missingFields.push('dueDate');
  }

  // categoryId is optional - default will be applied in builder

  if (!params.contractNumber) {
    missingFields.push('contractNumber');
  }

  if (!params.areaInformante) {
    missingFields.push('areaInformante');
  }

  if (!params.debtor || !params.debtor.documentNumber) {
    missingFields.push('debtor.documentNumber');
  }

  if (!params.creditor || !params.creditor.documentNumber) {
    missingFields.push('creditor.documentNumber');
  }

  const addressValidation = validateAddress(params.debtor?.address, 'debtor.address.');
  if (!addressValidation.valid) {
    missingFields.push(...addressValidation.missingFields);
  }

  if (missingFields.length > 0) {
    const error = buildDomainError(
      'SERASA_PEFIN_CAMPOS_OBRIGATORIOS_FALTANTES',
      400,
      'SERASA_PEFIN_MISSING_REQUIRED_FIELDS'
    );
    error.missingFields = missingFields;
    throw error;
  }

  return addressValidation.normalized;
}

function validateGuarantorInput(params) {
  const missingFields = [];

  if (!params.value || !validateValue(params.value)) {
    missingFields.push('value');
  }

  if (!params.dueDate || !validateDateFormat(params.dueDate)) {
    missingFields.push('dueDate');
  }

  // categoryId is optional - default will be applied in builder

  if (!params.contractNumber) {
    missingFields.push('contractNumber');
  }

  if (!params.debtorDocument) {
    missingFields.push('debtorDocument');
  }

  if (!params.creditor || !params.creditor.documentNumber) {
    missingFields.push('creditor.documentNumber');
  }

  if (!params.guarantor || !params.guarantor.documentNumber) {
    missingFields.push('guarantor.documentNumber');
  }

  const addressValidation = validateAddress(params.guarantor?.address, 'guarantor.address.');
  if (!addressValidation.valid) {
    missingFields.push(...addressValidation.missingFields);
  }

  if (missingFields.length > 0) {
    const error = buildDomainError(
      'SERASA_PEFIN_CAMPOS_OBRIGATORIOS_FALTANTES',
      400,
      'SERASA_PEFIN_MISSING_REQUIRED_FIELDS'
    );
    error.missingFields = missingFields;
    throw error;
  }

  return addressValidation.normalized;
}

function buildMainDebtPayload(params) {
  const normalizedAddress = validateMainDebtInput(params);

  const documentsToCheck = [
    params.debtor?.documentNumber,
    params.creditor?.documentNumber,
  ];

  const uatValidation = validateUatDocuments(documentsToCheck);
  if (!uatValidation.valid) {
    const error = buildDomainError(
      'SERASA_PEFIN_DOCUMENTO_NAO_AUTORIZADO_UAT',
      400,
      'SERASA_PEFIN_UAT_DOCUMENT_NOT_ALLOWED'
    );
    error.blockedDocuments = uatValidation.blockedDocuments;
    throw error;
  }

  const payload = {
    value: parseFloat(Number(params.value).toFixed(SERASA_CONSTANTS.VALUE_DECIMALS)),
    areaInformante: String(params.areaInformante),
    dueDate: normalizeDate(params.dueDate),
    categoryId: params.categoryId || SERASA_CONSTANTS.CATEGORY_ID,
    debtor: {
      documentNumber: digitsOnly(params.debtor.documentNumber),
      name: normalizeString(params.debtor.name),
      address: normalizedAddress,
    },
    creditor: {
      documentNumber: digitsOnly(params.creditor.documentNumber),
    },
    contractNumber: String(params.contractNumber),
    debtType: SERASA_CONSTANTS.DEBT_TYPE,
  };

  if (params.bankSlip) {
    payload.bankSlip = params.bankSlip;
  }

  if (params.debtorDigitalContact) {
    payload.debtorDigitalContact = params.debtorDigitalContact;
  }

  return payload;
}

function buildGuarantorPayload(params) {
  const normalizedAddress = validateGuarantorInput(params);

  const documentsToCheck = [
    params.debtorDocument,
    params.creditor?.documentNumber,
    params.guarantor?.documentNumber,
  ];

  const uatValidation = validateUatDocuments(documentsToCheck);
  if (!uatValidation.valid) {
    const error = buildDomainError(
      'SERASA_PEFIN_DOCUMENTO_NAO_AUTORIZADO_UAT',
      400,
      'SERASA_PEFIN_UAT_DOCUMENT_NOT_ALLOWED'
    );
    error.blockedDocuments = uatValidation.blockedDocuments;
    throw error;
  }

  const payload = {
    categoryId: params.categoryId || SERASA_CONSTANTS.CATEGORY_ID,
    value: parseFloat(Number(params.value).toFixed(SERASA_CONSTANTS.VALUE_DECIMALS)),
    dueDate: normalizeDate(params.dueDate),
    debtorDocument: digitsOnly(params.debtorDocument),
    contractNumber: String(params.contractNumber),
    guarantor: {
      documentNumber: digitsOnly(params.guarantor.documentNumber),
      name: normalizeString(params.guarantor.name),
      address: normalizedAddress,
    },
    creditor: {
      documentNumber: digitsOnly(params.creditor.documentNumber),
    },
    debtType: SERASA_CONSTANTS.DEBT_TYPE,
  };

  return payload;
}

function maskDocument(document) {
  if (!document) {
    return '';
  }
  const normalized = digitsOnly(document);
  if (normalized.length <= 3) {
    return '***';
  }
  if (normalized.length <= 11) {
    return `${normalized.slice(0, 3)}.***.${normalized.slice(-2)}`;
  }
  return `${normalized.slice(0, 2)}.***.${normalized.slice(-2)}`;
}

function maskPayload(payload, options = {}) {
  const { maskDocuments = true, maskFinancial = false } = options;

  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const masked = JSON.parse(JSON.stringify(payload));

  if (maskDocuments) {
    if (masked.debtor?.documentNumber) {
      masked.debtor.documentNumber = maskDocument(masked.debtor.documentNumber);
    }
    if (masked.creditor?.documentNumber) {
      masked.creditor.documentNumber = maskDocument(masked.creditor.documentNumber);
    }
    if (masked.guarantor?.documentNumber) {
      masked.guarantor.documentNumber = maskDocument(masked.guarantor.documentNumber);
    }
    if (masked.debtorDocument) {
      masked.debtorDocument = maskDocument(masked.debtorDocument);
    }
  }

  if (maskFinancial) {
    if (masked.value !== undefined) {
      masked.value = '***.**';
    }
    if (masked.bankSlip?.value) {
      masked.bankSlip.value = '***.**';
    }
  }

  return masked;
}

function getPreviewGuarantorId(guarantor, index) {
  return normalizeString(
    guarantor?.ID_ASSOCIADO ??
    guarantor?.idAssociado ??
    index
  );
}

function normalizeMissingAddressField(field, prefix) {
  if (field === `${prefix}address`) {
    return prefix.endsWith('.') ? prefix.slice(0, -1) : prefix;
  }
  return field;
}

function validatePreviewData({ inadimplencia, garantidores = [] }) {
  const principalMissingFields = [];

  if (!inadimplencia) {
    principalMissingFields.push('inadimplencia');
    return {
      valid: false,
      principalValid: false,
      missingFields: principalMissingFields,
      principalMissingFields,
      guarantorMissingFields: [],
      addressNormalized: null,
      validGuarantors: [],
      guarantorValidations: [],
    };
  }

  if (!inadimplencia.DOCUMENTO_DEVEDOR) {
    principalMissingFields.push('DOCUMENTO_DEVEDOR');
  }

  if (!inadimplencia.VALOR || !validateValue(inadimplencia.VALOR)) {
    principalMissingFields.push('VALOR');
  }

  if (!inadimplencia.DATA_VENCIMENTO || !validateDateFormat(inadimplencia.DATA_VENCIMENTO)) {
    principalMissingFields.push('DATA_VENCIMENTO');
  }

  const addressValidation = validateAddress(inadimplencia.address, 'devedor.address.');
  if (!addressValidation.valid) {
    principalMissingFields.push(
      ...addressValidation.missingFields.map((field) =>
        normalizeMissingAddressField(field, 'devedor.address.')
      )
    );
  }

  const guarantorValidations = garantidores.map((guarantor, index) => {
    const gMissing = [];
    const idAssociado = getPreviewGuarantorId(guarantor, index);

    if (!guarantor?.DOCUMENTO_GARANTIDOR) {
      gMissing.push('DOCUMENTO_GARANTIDOR');
    }

    const gAddressValidation = validateAddress(guarantor?.address, 'address.');
    if (!gAddressValidation.valid) {
      gMissing.push(
        ...gAddressValidation.missingFields.map((field) =>
          normalizeMissingAddressField(field, 'address.')
        )
      );
    }

    return {
      index,
      idAssociado,
      guarantor,
      valid: gMissing.length === 0,
      missingFields: gMissing,
      addressNormalized: gAddressValidation.normalized,
    };
  });

  const guarantorMissingFields = guarantorValidations.flatMap((validation) =>
    validation.missingFields.map((field) => `garantidores[${validation.idAssociado}].${field}`)
  );

  const validGuarantors = guarantorValidations
    .filter((validation) => validation.valid)
    .map((validation) => ({
      ...validation.guarantor,
      addressNormalized: validation.addressNormalized,
    }));

  return {
    valid: principalMissingFields.length === 0 && guarantorMissingFields.length === 0,
    principalValid: principalMissingFields.length === 0,
    missingFields: [...principalMissingFields, ...guarantorMissingFields],
    principalMissingFields,
    guarantorMissingFields,
    addressNormalized: addressValidation.normalized,
    validGuarantors,
    guarantorValidations,
  };
}

module.exports = {
  buildGuarantorPayload,
  buildMainDebtPayload,
  maskDocument,
  maskPayload,
  normalizeAddress,
  normalizeCurrency,
  normalizeDate,
  normalizeString,
  validateAddress,
  validateDateFormat,
  validatePreviewData,
  validateUatDocuments,
  validateValue,
  SERASA_CONSTANTS,
  UAT_TEST_DOCUMENTS,
};
