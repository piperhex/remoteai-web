import { RotateCw } from 'lucide-react';
import type { MarketText } from '../../provider-market/i18n';
import { deviceGroups, maxDimension, minDimension, responsiveDevice, type DeviceSelection } from './deviceViewport';

function DimensionInput({ value, label, apply }: { value: number; label: string; apply: (value: number) => void }) {
  return <input key={value} type="number" inputMode="numeric" step={1} min={minDimension} max={maxDimension}
    defaultValue={value} aria-label={label} title={label}
    onFocus={event => event.currentTarget.select()}
    onBlur={({ currentTarget }) => {
      const next = currentTarget.valueAsNumber;
      if (currentTarget.validity.valid && Number.isInteger(next) && value !== next) apply(next);
      else currentTarget.value = String(value);
    }}
    onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); event.currentTarget.value = String(value); }
      if (event.key === 'Enter' || event.key === 'Escape') event.currentTarget.blur();
    }} />;
}

export function DeviceToolbar({ device, change, scale, t }: {
  device: DeviceSelection; change: (next: DeviceSelection) => void; scale: number; t: MarketText;
}) {
  const selectDevice = (name: string) => {
    const preset = deviceGroups.flatMap(group => group.devices).find(([id]) => id === name);
    change(preset ? { name, width: preset[1], height: preset[2] } : { ...device, name: responsiveDevice });
  };
  const dimension = (axis: 'width' | 'height', label: string) => <DimensionInput
    value={device[axis]} label={label} apply={value => change({ ...device, name: responsiveDevice, [axis]: value })} />;
  return <div className="browser-device-toolbar" role="group" aria-label={t('market.inspectorMobile')}>
    <label>{t('market.inspectorDevice')}
      <select value={device.name} onChange={event => selectDevice(event.target.value)}>
        <option value={responsiveDevice}>{t('market.inspectorResponsive')}</option>
        {deviceGroups.map(group => <optgroup key={group.label} label={t(group.label)}>
          {group.devices.map(([name]) => <option key={name} value={name}>{name}</option>)}
        </optgroup>)}
      </select>
    </label>
    <div className="browser-device-size">
      {dimension('width', t('market.inspectorWidth'))}<span aria-hidden="true">×</span>
      {dimension('height', t('market.inspectorHeight'))}
      <button type="button" aria-label={t('market.inspectorRotate')} title={t('market.inspectorRotate')}
        onClick={() => change({ ...device, width: device.height, height: device.width })}>
        <RotateCw size="1.15em" aria-hidden="true" />
      </button>
      <span className="browser-device-scale">{Math.round(scale * 100)}%</span>
    </div>
  </div>;
}
