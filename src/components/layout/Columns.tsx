import { ReactNode } from 'react';

type ColumnsProps = {
  children: ReactNode;
};

export function Columns({ children }: ColumnsProps) {
  return <main className="columns">{children}</main>;
}
