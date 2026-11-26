import type { ReactNode } from 'react';
import { computerDetails, type ComputerSystem } from './devices';
import './computerIdentity.css';

export function ComputerIdentity({ name, device }: { name: ReactNode; device?: ComputerSystem }) {
  const details = computerDetails(device);
  return <span className="computer-identity"><span>{name}</span>
    {details && <small>{details}</small>}</span>;
}
