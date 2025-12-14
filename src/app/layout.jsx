import './globals.css';

export const metadata = {
  title: 'Inferno City - 炎上都市',
  description: 'A local PvP fire spread simulation game set in 3D Kyoto city',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}


