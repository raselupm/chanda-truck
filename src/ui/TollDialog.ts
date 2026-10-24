import { PaymentDialog } from './PaymentDialog';

/** Legal toll / road tax: official, printed receipt look. */
export class TollDialog extends PaymentDialog {
  constructor(parent: HTMLElement) {
    super(parent, {
      className: 'toll',
      icon: '{govt}',
      receiptBn: 'সরকারি রশিদ প্রদান করা হলো {check}',
      payLabel: (amount) => `টোল দিন ${amount}`,
      inKindNote: (cash, kg) => `নগদ ${cash} — বাকিটা মেটাতে ${kg} মাল রেখে যেতে হবে।`,
    });
  }
}
