import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN_VOUCHER_CODE,
  CAMPAIGN_VOUCHER_PAYABLE_INR,
  getCampaignVoucherPricing,
} from './campaignVoucher';

describe('campaignVoucher', () => {
  it('defaults to MODERNJAVA at ₹699 against the digital listing price', () => {
    expect(CAMPAIGN_VOUCHER_CODE).toBe('MODERNJAVA');
    expect(CAMPAIGN_VOUCHER_PAYABLE_INR).toBe(699);
    const pricing = getCampaignVoucherPricing();
    expect(pricing.basisAmountInr).toBe(899);
    expect(pricing.payableAmountInr).toBe(699);
    expect(pricing.discountAmountInr).toBe(200);
  });
});
