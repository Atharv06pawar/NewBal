import type { Voucher } from '@newbal/shared';

/**
 * Enterprise Audit Trail & Cryptographic Tamper-Proofing Engine
 * Complies with Ministry of Corporate Affairs (MCA) Section 128 & Rule 3 Audit Trail guidelines.
 */
export class AuditSecurityEngine {
  /**
   * Compute a deterministic SHA-256 hash for a financial voucher
   */
  static async computeVoucherHash(voucher: Voucher): Promise<string> {
    // Canonical representation of financial transaction details
    const normalizedEntries = [...voucher.entries]
      .sort((a, b) => a.ledgerId.localeCompare(b.ledgerId))
      .map((e) => `${e.ledgerId}:${e.type}:${e.amount.toFixed(2)}`)
      .join('|');

    const canonicalString = [
      voucher.companyId,
      voucher.voucherNumber,
      voucher.voucherType,
      voucher.date,
      voucher.grandTotal.toFixed(2),
      normalizedEntries,
      voucher.status,
    ].join('::');

    const encoder = new TextEncoder();
    const data = encoder.encode(canonicalString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Verify whether a voucher has been tampered with or modified without authorization
   */
  static async verifyVoucherIntegrity(voucher: Voucher & { auditHash?: string }): Promise<{ isValid: boolean; expectedHash: string }> {
    const expectedHash = await this.computeVoucherHash(voucher);
    if (!voucher.auditHash) {
      // Legacy or newly created without stored hash
      return { isValid: true, expectedHash };
    }
    return {
      isValid: voucher.auditHash === expectedHash,
      expectedHash,
    };
  }

  /**
   * Audit trail record builder
   */
  static createAuditEntry(params: {
    companyId: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'CANCEL' | 'AUDIT_VERIFY';
    entity: string;
    entityId: string;
    user: string;
    details: string;
    hash?: string;
  }) {
    return {
      id: `audit-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      companyId: params.companyId,
      timestamp: new Date().toISOString(),
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      user: params.user,
      details: params.details,
      hash: params.hash || '',
    };
  }
}
