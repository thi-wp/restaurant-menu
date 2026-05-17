import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Quản Lý Thực Đơn | Hệ Thống Quản Lý Quán Ăn',
  description:
    'Hệ thống quản lý thực đơn nhà hàng tích hợp phân quyền theo vai trò — Manager và Waiter.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
