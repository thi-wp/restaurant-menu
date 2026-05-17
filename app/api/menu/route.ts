/**
 * app/api/menu/route.ts
 * GET  /api/menu  — lấy danh sách món ăn (hỗ trợ ?search= và ?category=)
 * POST /api/menu  — thêm món mới
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';

/* ── GET ──────────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search   = searchParams.get('search')   ?? '';
  const category = searchParams.get('category') ?? '';

  try {
    const pool    = await getPool();
    const request = pool.request();

    // Parameterized query — chống SQL Injection
    request.input('search',   sql.NVarChar, `%${search}%`);
    request.input('category', sql.NVarChar, category);

    const result = await request.query(`
      SELECT
        m.ItemId        AS id,
        m.ItemName      AS name,
        c.CategoryName  AS category,
        m.UnitPrice     AS price,
        m.Description   AS description,
        m.IsAvailable   AS isAvailable,
        m.ModifiedDate  AS modifiedDate
      FROM dbo.MenuItems m
      INNER JOIN dbo.Categories c ON m.CategoryId = c.CategoryId
      WHERE
        m.ItemName LIKE @search
        AND (@category = '' OR c.CategoryName = @category)
      ORDER BY c.CategoryName, m.ItemName
    `);

    // Chuyển IsAvailable (bit 1/0) thành boolean JavaScript
    const items = result.recordset.map((row) => ({
      ...row,
      isAvailable: row.isAvailable === true || row.isAvailable === 1,
    }));

    return NextResponse.json(items);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[GET /api/menu]', message);
    return NextResponse.json(
      { error: 'Không thể lấy danh sách món ăn.', detail: message },
      { status: 500 }
    );
  }
}

/* ── POST ─────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, categoryName, price, description, isAvailable } = body;

    // Validate
    if (!name?.trim())       return NextResponse.json({ error: 'Thiếu tên món ăn.' }, { status: 400 });
    if (!categoryName?.trim()) return NextResponse.json({ error: 'Thiếu danh mục.' }, { status: 400 });
    if (!price || Number(price) < 1000) return NextResponse.json({ error: 'Giá không hợp lệ (tối thiểu 1.000đ).' }, { status: 400 });

    const pool    = await getPool();
    const request = pool.request();

    // Lấy CategoryId từ CategoryName
    request.input('categoryName', sql.NVarChar, categoryName.trim());
    const catResult = await request.query(
      `SELECT CategoryId FROM dbo.Categories WHERE CategoryName = @categoryName`
    );

    if (catResult.recordset.length === 0) {
      return NextResponse.json({ error: `Danh mục "${categoryName}" không tồn tại trong DB.` }, { status: 400 });
    }

    const categoryId = catResult.recordset[0].CategoryId;

    const insertReq = pool.request();
    insertReq.input('name',        sql.NVarChar,    name.trim());
    insertReq.input('categoryId',  sql.Int,         categoryId);
    insertReq.input('price',       sql.Decimal(18,2), Number(price));
    insertReq.input('description', sql.NVarChar,    description?.trim() ?? null);
    const isAvailBool = isAvailable === true || isAvailable === 'true' || isAvailable === 1;
    insertReq.input('isAvailable', sql.Bit,         isAvailBool ? 1 : 0);

    const insertResult = await insertReq.query(`
      INSERT INTO dbo.MenuItems (ItemName, CategoryId, UnitPrice, Description, IsAvailable)
      OUTPUT
        INSERTED.ItemId        AS id,
        INSERTED.ItemName      AS name,
        INSERTED.UnitPrice     AS price,
        INSERTED.IsAvailable   AS isAvailable,
        INSERTED.Description   AS description
      VALUES (@name, @categoryId, @price, @description, @isAvailable);
    `);

    const created = insertResult.recordset[0];
    return NextResponse.json(
      { ...created, category: categoryName, isAvailable: created.isAvailable === true || created.isAvailable === 1 },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[POST /api/menu]', message);
    return NextResponse.json(
      { error: 'Không thể thêm món ăn.', detail: message },
      { status: 500 }
    );
  }
}
