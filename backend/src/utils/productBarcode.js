export const normalizeProductBarcode = (value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return value;
  const barcode = value.trim();
  return barcode || undefined;
};

export const normalizeOptionalPartNumber = (value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return value;
  return value.trim() || undefined;
};

export const normalizeProductCreateFields = (fields = {}) => {
  const { barcode, ...productFields } = fields;
  const normalizedBarcode = normalizeProductBarcode(barcode);
  const { oemPartNumber, ...fieldsWithoutOemPartNumber } = productFields;
  const normalizedOemPartNumber = normalizeOptionalPartNumber(oemPartNumber);
  return {
    ...fieldsWithoutOemPartNumber,
    ...(normalizedBarcode === undefined ? {} : { barcode: normalizedBarcode }),
    ...(normalizedOemPartNumber === undefined
      ? {}
      : { oemPartNumber: normalizedOemPartNumber }),
  };
};

export const normalizeProductUpdateFields = (fields = {}) => {
  const { barcode, oemPartNumber, ...requestedChanges } = fields;
  const normalizedBarcode = normalizeProductBarcode(barcode);
  const normalizedOemPartNumber = normalizeOptionalPartNumber(oemPartNumber);
  return {
    changes: {
      ...requestedChanges,
      ...(Object.hasOwn(fields, "barcode") && normalizedBarcode !== undefined
        ? { barcode: normalizedBarcode }
        : {}),
      ...(Object.hasOwn(fields, "oemPartNumber") &&
      normalizedOemPartNumber !== undefined
        ? { oemPartNumber: normalizedOemPartNumber }
        : {}),
    },
    clearBarcode:
      Object.hasOwn(fields, "barcode") && normalizedBarcode === undefined,
    clearOemPartNumber:
      Object.hasOwn(fields, "oemPartNumber") &&
      normalizedOemPartNumber === undefined,
  };
};
