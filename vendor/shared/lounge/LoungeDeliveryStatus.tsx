import { Check, CheckCheck, Clock3, CircleAlert, Image } from 'lucide-react';
import { displayText as t } from '../localization/messages';
import { deliveryLabel, type LoungeDelivery } from './delivery';
import { LoungeGroupReadStatus } from './LoungeGroupReadStatus';
import type { LoungeMessage } from './types';
import type { LoungeController } from './controller';

export function LoungeDeliveryStatus({ delivery, message, controller }: {
  delivery?: LoungeDelivery; message?: LoungeMessage; controller?: LoungeController;
}) {
  if (message?.groupReceipt && !message.recipient) return controller
    ? <LoungeGroupReadStatus message={message} controller={controller} /> : null;
  if (delivery?.direction !== 'outgoing') return null;
  const Icon = { read: CheckCheck, delivered: Check, pending: Clock3, rejected: CircleAlert }[delivery.status];
  if (delivery.status === 'pending' && delivery.messageStored) return <span className="lounge-delivery">
    <span role="img" aria-label={t('client.lounge.delivered')} title={t('client.lounge.delivered')}><Check size={15} /></span>
    <span role="img" aria-label={t('client.lounge.awaitingReceipt')} title={t('client.lounge.awaitingReceipt')}>
      <Image size={15} /><Clock3 size={12} />
    </span>
  </span>;
  return <span className={`lounge-delivery is-${delivery.status}`} role="img"
    aria-label={t(deliveryLabel(delivery.status))} title={t(deliveryLabel(delivery.status))}>
    <Icon size={15} aria-hidden="true" /></span>;
}
