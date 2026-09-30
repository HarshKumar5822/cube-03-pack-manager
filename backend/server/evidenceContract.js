'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const schemaPath = path.join(__dirname, '..', 'contract', 'evidence-contract.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validateFn = ajv.compile(schema);

function validateEvidenceRecord(record) {
  const valid = validateFn(record);
  return {
    valid,
    errors: valid ? [] : (validateFn.errors || []).map((e) => `${e.instancePath} ${e.message}`),
  };
}

module.exports = { validateEvidenceRecord };
