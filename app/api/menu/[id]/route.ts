/**
 * app/api/menu/[id]/route.ts
 * PUT    /api/menu/:id — cập nhật món ăn
 * DELETE /api/menu/:id — xóa món ăn
 * PATCH  /api/menu/:id — toggle trạng thái IsAvailable
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';

type RouteContext = { params: Promise<{ id: string }> };

/* ── PUT — Cập nhật toàn bộ thông tin món ────────────────── */
export async function PUT(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const itemId = parseInt(id, 10);

  if (isNaN(itemId)) {
    return NextResponse.json({ error: 'ID không hợp lệ.' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { name, categoryName, price, description, isAvailable } = body;

    if (!name?.trim())       return NextResponse.json({ error: 'Thiếu tên món ăn.' }, { status: 400 });
    if (!categoryName?.trim()) return NextResponse.json({ error: 'Thiếu danh mục.' }, { status: 400 });
    if (!price || Number(price) < 1000) return NextResponse.json({ error: 'Giá không hợp lệ.' }, { status: 400 });

    const pool = await getPool();

    // Lấy CategoryId
    const catReq = pool.request();
    catReq.input('categoryName', sql.NVarChar, categoryName.trim());
    const catResult = await catReq.query(
      `SELECT CategoryId FROM dbo.Categories WHERE CategoryName = @categoryName`
    );

    if (catResult.recordset.length === 0) {
      return NextResponse.json({ error: `Danh mục "${categoryName}" không tồn tại.` }, { status: 400 });
    }

    const categoryId = catResult.recordset[0].CategoryId;

    const updateReq = pool.request();
    updateReq.input('itemId',      sql.Int,           itemId);
    updateReq.input('name',        sql.NVarChar,      name.trim());
    updateReq.input('categoryId',  sql.Int,           categoryId);
    updateReq.input('price',       sql.Decimal(18,2), Number(price));
    updateReq.input('description', sql.NVarChar,      description?.trim() ?? null);
    updateReq.input('isAvailable', sql.Bit,           isAvailable !== false ? 1 : 0);

    const result = await updateReq.query(`
      UPDATE dbo.MenuItems
      SET
        ItemName     = @name,
        CategoryId   = @categoryId,
        UnitPrice    = @price,
        Description  = @description,
        IsAvailable  = @isAvailable,
        ModifiedDate = SYSUTCDATETIME()
      WHERE ItemId = @itemId;

      SELECT @@ROWCOUNT AS affected;
    `);

    if (result.recordset[0].affected === 0) {
      return NextResponse.json({ error: 'Không tìm thấy món ăn.' }, { status: 404 });
    }

    return NextResponse.json({
      id: itemId,
      name: name.trim(),
      category: categoryName,
      price: Number(price),
      description: description?.trim() ?? '',
      isAvailable: isAvailable !== false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[PUT /api/menu/${id}]`, message);
    return NextResponse.json(
      { error: 'Không thể cập nhật món ăn.', detail: message },
      { status: 500 }
    );
  }
}

/* ── PATCH — Toggle IsAvailable ──────────────────────────── */
export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const itemId = parseInt(id, 10);

  if (isNaN(itemId)) {
    return NextResponse.json({ error: 'ID không hợp lệ.' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const isAvailable: boolean = body.isAvailable;

    const pool    = await getPool();
    const request = pool.request();
    request.input('itemId',      sql.Int, itemId);
    request.input('isAvailable', sql.Bit, isAvailable ? 1 : 0);

    const result = await request.query(`
      UPDATE dbo.MenuItems
      SET IsAvailable = @isAvailable, ModifiedDate = SYSUTCDATETIME()
      WHERE ItemId = @itemId;
      SELECT @@ROWCOUNT AS affected;
    `);

    if (result.recordset[0].affected === 0) {
      return NextResponse.json({ error: 'Không tìm thấy món ăn.' }, { status: 404 });
    }

    return NextResponse.json({ id: itemId, isAvailable });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[PATCH /api/menu/${id}]`, message);
    return NextResponse.json(
      { error: 'Không thể cập nhật trạng thái.', detail: message },
      { status: 500 }
    );
  }
}

/* ── DELETE ───────────────────────────────────────────────── */
export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const itemId = parseInt(id, 10);

  if (isNaN(itemId)) {
    return NextResponse.json({ error: 'ID không hợp lệ.' }, { status: 400 });
  }

  try {
    const pool    = await getPool();
    const request = pool.request();
    request.input('itemId', sql.Int, itemId);

    // Kiểm tra xem món có đang được dùng trong OrderDetails không
    const usageCheck = await request.query(`
      SELECT COUNT(1) AS cnt
      FROM dbo.OrderDetails
      WHERE ItemId = @itemId;
    `);

    if (usageCheck.recordset[0].cnt > 0) {
      return NextResponse.json(
        { error: 'Không thể xóa — món này đã từng được đặt hàng (lưu trong lịch sử). Vui lòng tắt "Đang bán" thay vì xóa.' },
        { status: 409 }
      );
    }

    const deleteReq = pool.request();
    deleteReq.input('itemId', sql.Int, itemId);
    const result = await deleteReq.query(`
      DELETE FROM dbo.MenuItems WHERE ItemId = @itemId;
      SELECT @@ROWCOUNT AS affected;
    `);

    if (result.recordset[0].affected === 0) {
      return NextResponse.json({ error: 'Không tìm thấy món ăn.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, id: itemId });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[DELETE /api/menu/${id}]`, message);
    return NextResponse.json(
      { error: 'Không thể xóa món ăn.', detail: message },
      { status: 500 }
    );
  }
}
