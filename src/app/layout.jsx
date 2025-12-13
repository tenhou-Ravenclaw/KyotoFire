import './globals.css';

export const metadata = {
  title: 'Urban Fire PvP',
  description: 'Kyoto Fire Simulation Game',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}

