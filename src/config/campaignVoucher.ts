import { getAmountInr } from './prices';

/** Multi-use site checkout code. Must match backend CAMPAIGN_VOUCHER_CODE. */
export const CAMPAIGN_VOUCHER_CODE = (
  import.meta.env.VITE_CAMPAIGN_VOUCHER_CODE || 'MODERNJAVA'
)
  .trim()
  .toUpperCase();

/** Fixed campaign / reader payable amount (INR). Matches READER_VOUCHER_PAYABLE_INR. */
export const CAMPAIGN_VOUCHER_PAYABLE_INR = Number(
  import.meta.env.VITE_CAMPAIGN_VOUCHER_PAYABLE_INR || 699,
);

export function getCampaignVoucherPricing() {
  const basisAmountInr = getAmountInr('digital');
  const payableAmountInr = CAMPAIGN_VOUCHER_PAYABLE_INR;
  return {
    voucherCode: CAMPAIGN_VOUCHER_CODE,
    basisAmountInr,
    payableAmountInr,
    discountAmountInr: basisAmountInr - payableAmountInr,
  };
}
