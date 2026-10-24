import { PaymentDialog } from './PaymentDialog';

/** Illegal extortion: hand-written receipt look, paying is the only option. */
export class ChandaDialog extends PaymentDialog {
  constructor(parent: HTMLElement) {
    super(parent, {
      className: 'chanda',
      icon: '✋',
      receiptBn: 'রশিদ নং: ???  ·  "উপরে জানিয়ে দেওয়া হবে"',
      payLabel: (amount) => `${amount} দিন 😔`,
      inKindNote: (cash, kg) => `নগদ ${cash} নেওয়া হবে, বাকিটার বদলে ট্রাক থেকে ${kg} মাল নামিয়ে নেবে।`,
    });
  }
}
