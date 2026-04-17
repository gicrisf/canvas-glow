import { ReactNode } from 'react';
import './Layout.css';

type LayoutProps = {
  children: ReactNode;
};

export function Layout({ children }: LayoutProps) {
  return <div className="layout">{children}</div>;
}
