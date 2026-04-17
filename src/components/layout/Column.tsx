import { ReactNode } from 'react';

type ColumnProps = {
  children: ReactNode;
};

export function Column({ children }: ColumnProps) {
  return <section className="column">{children}</section>;
}
