import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Benchmark Exports | Production & Quality Control Tower',
  description: 'Large-format live production TV and a separate line-wise quality and DHU command centre for Benchmark Exports.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
