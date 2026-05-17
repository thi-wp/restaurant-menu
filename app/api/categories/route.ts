/**
 * app/api/categories/route.ts
 * GET /api/categories — trả về danh sách danh mục từ DB
 */

import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export async function GET() {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT CategoryId, CategoryName, Description
      FROM dbo.Categories
      ORDER BY CategoryName
    `);

    return NextResponse.json(result.recordset);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[GET /api/categories]', message);
    return NextResponse.json(
      { error: 'Không thể lấy danh mục. Kiểm tra kết nối SQL Server.', detail: message },
      { status: 500 }
    );
  }
}
