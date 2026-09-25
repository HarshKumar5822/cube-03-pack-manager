/**
 * Engineering Rule 1: Tenancy isolation before any feature.
 * Row-Level Security (RLS) guard for org_demo_alpha and org_demo_bravo.
 */

const ALLOWED_TENANTS = new Set(['org_demo_alpha', 'org_demo_bravo']);

class TenancyGuardError extends Error {
  constructor(message, tenantId, targetOrgId) {
    super(message);
    this.name = 'TenancyGuardError';
    this.tenantId = tenantId;
    this.targetOrgId = targetOrgId;
  }
}

/**
 * Verifies that the requested context tenant matches the record's org_id.
 * Throws a TenancyGuardError if cross-tenant violation is detected.
 * @param {string} requestTenantId - Tenant making the API call
 * @param {string} recordOrgId - Target record tenant ID
 */
function verifyTenantAccess(requestTenantId, recordOrgId) {
  if (!requestTenantId || !ALLOWED_TENANTS.has(requestTenantId)) {
    throw new TenancyGuardError(
      `Invalid or unauthenticated organization tenant: '${requestTenantId}'`,
      requestTenantId,
      recordOrgId
    );
  }

  if (requestTenantId !== recordOrgId) {
    throw new TenancyGuardError(
      `SECURITY VIOLATION (Rule 1): Tenant '${requestTenantId}' denied access to data owned by '${recordOrgId}'`,
      requestTenantId,
      recordOrgId
    );
  }

  return true;
}

module.exports = {
  verifyTenantAccess,
  TenancyGuardError,
  ALLOWED_TENANTS
};
