import { Button, Drawer } from 'antd';
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { t, useLanguage } from '../../../../shared/localization/browserClient';
import './screenSheet.css';

const DEVICE_ACTIONS_Z_INDEX = 1050;
const MODEL_SELECTION_Z_INDEX = 1100;

interface DeviceBottomSheetProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  onBack?: () => void;
  dismissible?: boolean;
  children: ReactNode;
}

export function DeviceBottomSheet({
  open, title, subtitle, onClose, onBack, dismissible = true, children,
}: DeviceBottomSheetProps) {
  useLanguage();
  return <Drawer open={open} placement="bottom" height="auto"
    zIndex={onBack ? MODEL_SELECTION_Z_INDEX : DEVICE_ACTIONS_Z_INDEX}
    rootClassName="device-bottom-sheet" onClose={onClose} destroyOnHidden
    keyboard={dismissible} maskClosable={dismissible}
    closable={dismissible && { placement: 'end', 'aria-label': t('client.projectBrowser.close') }}
    title={<div className="device-bottom-sheet-title">
      {onBack && dismissible && <Button type="text" shape="circle" onClick={onBack}
        aria-label={t('client.app.goBackOneLevel')} icon={<ChevronLeft size={20} aria-hidden />} />}
      <div className="device-screen-heading"><strong>{title}</strong>{subtitle && <span>{subtitle}</span>}</div>
    </div>}>
    {children}
  </Drawer>;
}
